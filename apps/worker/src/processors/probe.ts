import { and, eq, inArray } from 'drizzle-orm'
import { loadEnv } from '@mpp/config'
import { type VideoMetadata } from '@mpp/core'
import { processingTasks, taskSteps, videos, type Database } from '@mpp/db'
import { ffprobe } from '@mpp/media'
import {
  DEFAULT_JOB_OPTIONS,
  JOB,
  QUEUE,
  makeFlowProducer,
  publishTaskEvent,
  type AudioJobData,
  type ClipJobData,
  type FinalizeJobData,
  type FramesJobData,
  type HlsJobData,
  type Job,
  type ProbeJobData,
  type RenditionJobData,
  type ThumbnailJobData,
} from '@mpp/queue'
import { download, makeScratch } from '../scratch'
import { isTaskActive } from '../cancel'

const RENDITION_LADDER = [360, 480, 720, 1080]

interface Plan {
  durationSec: number
  /** Poster timestamp. */
  atSec: number
  /** Frame interval. */
  intervalSec: number
  clip: { startSec: number; durationSec: number; height: number }
  renditions: { label: string; height: number }[]
}

/** Derives the artifact plan from probe metadata (no-upscale ladder + defaults). */
function computePlan(meta: VideoMetadata): Plan {
  const durationSec = meta.duration ?? 0
  const srcHeight = meta.height ?? 0
  let heights = RENDITION_LADDER.filter((h) => h <= srcHeight)
  if (heights.length === 0) heights = [Math.min(srcHeight || 360, 360)] // never upscale
  return {
    durationSec,
    atSec: durationSec > 0 ? Math.round(durationSec * 0.1) : 0,
    intervalSec: durationSec > 0 ? Math.max(10, Math.round(durationSec / 10)) : 10,
    clip: { startSec: 0, durationSec: durationSec > 0 ? Math.min(10, Math.ceil(durationSec)) : 10, height: 480 },
    renditions: heights.map((h) => ({ label: `${h}p`, height: h })),
  }
}

/**
 * Phase A (gate): ffprobe → metadata, then builds the phase-B fan-out flow
 * (finalize ⟵ { thumbnail, frames, clip, audio, hls ⟵ rendition_* }). Idempotent:
 * re-entry after a retry just re-adds the flow (deterministic jobIds dedupe it).
 */
export async function probeProcessor(job: Job<ProbeJobData>, db: Database): Promise<void> {
  const { videoId, taskId, accountId } = job.data
  if (!(await isTaskActive(db, taskId))) return // cancelled or video deleted
  const env = loadEnv()

  const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1)
  if (!video?.storageKey) throw new Error(`video ${videoId} has no source to probe`)
  const sourceKey = video.storageKey

  const [probeStep] = await db
    .select()
    .from(taskSteps)
    .where(and(eq(taskSteps.taskId, taskId), eq(taskSteps.type, 'probe')))
    .limit(1)

  let meta: VideoMetadata = video.metadata ?? {}

  if (probeStep?.status !== 'done') {
    // Atomically claim the task (queued/processing → processing). If it was
    // cancelled between the gate above and here, the guarded update touches no
    // rows → bail without resurrecting it.
    const claimed = await db.transaction(async (tx) => {
      const rows = await tx
        .update(processingTasks)
        .set({ status: 'processing', startedAt: new Date() })
        .where(and(eq(processingTasks.id, taskId), inArray(processingTasks.status, ['queued', 'processing'])))
        .returning({ id: processingTasks.id })
      if (rows.length === 0) return false
      await tx.update(videos).set({ status: 'processing' }).where(eq(videos.id, videoId))
      await tx
        .update(taskSteps)
        .set({ status: 'processing' })
        .where(and(eq(taskSteps.taskId, taskId), eq(taskSteps.type, 'probe')))
      return true
    })
    if (!claimed) return // cancelled or deleted

    // Emit started once (on the first attempt, not retries).
    if (probeStep?.status === 'pending') {
      await publishTaskEvent({ type: 'task.started', taskId, videoId, accountId, at: new Date().toISOString() })
    }

    const scratch = await makeScratch()
    try {
      const input = scratch.path('source')
      await download(sourceKey, input)
      meta = await ffprobe(input, { timeoutMs: env.PROBE_TIMEOUT_MS })
      const plan = computePlan(meta)
      const stepTypes = [
        'thumbnail',
        'frames',
        'clip',
        'audio',
        ...plan.renditions.map((r) => `rendition_${r.height}`),
        'hls',
      ]
      await db.transaction(async (tx) => {
        await tx.update(videos).set({ metadata: meta }).where(eq(videos.id, videoId))
        await tx
          .update(taskSteps)
          .set({ status: 'done', progress: 100 })
          .where(and(eq(taskSteps.taskId, taskId), eq(taskSteps.type, 'probe')))
        await tx.insert(taskSteps).values(stepTypes.map((type) => ({ taskId, type })))
      })
    } finally {
      await scratch.cleanup()
    }
  }

  const plan = computePlan(meta)
  const flow = makeFlowProducer()
  await flow.add({
    name: JOB.finalize,
    queueName: QUEUE.mediaHeavy,
    data: { videoId, taskId, accountId } satisfies FinalizeJobData,
    opts: { ...DEFAULT_JOB_OPTIONS, jobId: `finalize-${taskId}` },
    children: [
      {
        name: JOB.thumbnail,
        queueName: QUEUE.mediaLight,
        data: { videoId, taskId, accountId, sourceKey, atSec: plan.atSec } satisfies ThumbnailJobData,
        opts: { ...DEFAULT_JOB_OPTIONS, jobId: `thumbnail-${taskId}` },
      },
      {
        name: JOB.frames,
        queueName: QUEUE.mediaLight,
        data: { videoId, taskId, accountId, sourceKey, intervalSec: plan.intervalSec } satisfies FramesJobData,
        opts: { ...DEFAULT_JOB_OPTIONS, jobId: `frames-${taskId}` },
      },
      {
        name: JOB.clip,
        queueName: QUEUE.mediaLight,
        data: {
          videoId,
          taskId,
          accountId,
          sourceKey,
          startSec: plan.clip.startSec,
          durationSec: plan.clip.durationSec,
          height: plan.clip.height,
        } satisfies ClipJobData,
        opts: { ...DEFAULT_JOB_OPTIONS, jobId: `clip-${taskId}` },
      },
      {
        name: JOB.audio,
        queueName: QUEUE.mediaLight,
        data: { videoId, taskId, accountId, sourceKey } satisfies AudioJobData,
        opts: { ...DEFAULT_JOB_OPTIONS, jobId: `audio-${taskId}` },
      },
      {
        name: JOB.hls,
        queueName: QUEUE.mediaHeavy,
        data: { videoId, taskId, accountId, labels: plan.renditions.map((r) => r.label) } satisfies HlsJobData,
        opts: { ...DEFAULT_JOB_OPTIONS, jobId: `hls-${taskId}` },
        children: plan.renditions.map((r) => ({
          name: JOB.rendition,
          queueName: QUEUE.mediaHeavy,
          data: {
            videoId,
            taskId,
            accountId,
            sourceKey,
            label: r.label,
            height: r.height,
            durationSec: plan.durationSec || undefined,
          } satisfies RenditionJobData,
          opts: { ...DEFAULT_JOB_OPTIONS, jobId: `rendition-${r.height}-${taskId}` },
        })),
      },
    ],
  })
}
