import { and, eq } from 'drizzle-orm'
import { loadEnv } from '@mpp/config'
import { processingTasks, taskSteps, videos, type Database } from '@mpp/db'
import { ffprobe } from '@mpp/media'
import {
  DEFAULT_JOB_OPTIONS,
  JOB,
  QUEUE,
  makeFlowProducer,
  type FinalizeJobData,
  type Job,
  type ProbeJobData,
  type TranscodeJobData,
} from '@mpp/queue'
import { download, makeScratch } from '../scratch'

/**
 * Phase A (gate): ffprobe → metadata, then builds the phase-B flow
 * (finalize ⟵ transcode_720). Idempotent: re-entry after a retry just re-adds
 * the flow (deterministic jobIds dedupe it).
 */
export async function probeProcessor(job: Job<ProbeJobData>, db: Database): Promise<void> {
  const { videoId, taskId, accountId } = job.data
  const env = loadEnv()

  const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1)
  if (!video?.storageKey) throw new Error(`video ${videoId} has no source to probe`)

  const [probeStep] = await db
    .select()
    .from(taskSteps)
    .where(and(eq(taskSteps.taskId, taskId), eq(taskSteps.type, 'probe')))
    .limit(1)

  if (probeStep?.status !== 'done') {
    await db.transaction(async (tx) => {
      await tx.update(videos).set({ status: 'processing' }).where(eq(videos.id, videoId))
      await tx
        .update(processingTasks)
        .set({ status: 'processing', startedAt: new Date() })
        .where(eq(processingTasks.id, taskId))
      await tx
        .update(taskSteps)
        .set({ status: 'processing' })
        .where(and(eq(taskSteps.taskId, taskId), eq(taskSteps.type, 'probe')))
    })

    const scratch = await makeScratch()
    try {
      const input = scratch.path('source')
      await download(video.storageKey, input)
      const metadata = await ffprobe(input, { timeoutMs: env.PROBE_TIMEOUT_MS })
      await db.transaction(async (tx) => {
        await tx.update(videos).set({ metadata }).where(eq(videos.id, videoId))
        await tx
          .update(taskSteps)
          .set({ status: 'done', progress: 100 })
          .where(and(eq(taskSteps.taskId, taskId), eq(taskSteps.type, 'probe')))
        await tx.insert(taskSteps).values({ taskId, type: 'transcode_720' })
      })
    } finally {
      await scratch.cleanup()
    }
  }

  const flow = makeFlowProducer()
  await flow.add({
    name: JOB.finalize,
    queueName: QUEUE.mediaHeavy,
    data: { videoId, taskId, accountId } satisfies FinalizeJobData,
    opts: { ...DEFAULT_JOB_OPTIONS, jobId: `finalize-${taskId}` },
    children: [
      {
        name: JOB.transcode720,
        queueName: QUEUE.mediaHeavy,
        data: {
          videoId,
          taskId,
          accountId,
          sourceKey: video.storageKey,
          label: '720p',
        } satisfies TranscodeJobData,
        opts: { ...DEFAULT_JOB_OPTIONS, jobId: `transcode-${taskId}` },
      },
    ],
  })
}
