import { readFile } from 'node:fs/promises'
import { and, eq } from 'drizzle-orm'
import { loadEnv } from '@mpp/config'
import { aggregateTaskProgress } from '@mpp/core'
import { artifacts, processingTasks, taskSteps, type Database } from '@mpp/db'
import { transcode720 } from '@mpp/media'
import { putObject, renditionKey } from '@mpp/storage'
import { publishTaskEvent, type Job, type TranscodeJobData } from '@mpp/queue'
import { download, makeScratch } from '../scratch'

// Throttle live progress: publish at most every interval, but always on a big jump.
const PROGRESS_THROTTLE_MS = 1000
const PROGRESS_MIN_DELTA = 5

/** Phase B leaf: transcode to 720p, upload, record the artifact (idempotent via unique key). */
export async function transcodeProcessor(job: Job<TranscodeJobData>, db: Database): Promise<void> {
  const { videoId, taskId, accountId, sourceKey, label, durationSec } = job.data
  const env = loadEnv()
  const outKey = renditionKey(accountId, videoId, label)

  // Throttled progress: persist the snapshot to Postgres and publish a live event.
  let lastAt = 0
  let lastPct = -1
  let publishing = false
  const onProgress = (pct: number): void => {
    const now = Date.now()
    if (pct < 100 && now - lastAt < PROGRESS_THROTTLE_MS && pct - lastPct < PROGRESS_MIN_DELTA) return
    if (publishing) return
    lastAt = now
    lastPct = pct
    publishing = true
    void persistProgress(pct).finally(() => {
      publishing = false
    })
  }

  async function persistProgress(pct: number): Promise<void> {
    const taskProgress = aggregateTaskProgress([
      { type: 'probe', progress: 100 },
      { type: 'transcode_720', progress: pct },
    ])
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(taskSteps)
          .set({ progress: pct })
          .where(and(eq(taskSteps.taskId, taskId), eq(taskSteps.type, 'transcode_720')))
        await tx
          .update(processingTasks)
          .set({ progress: taskProgress })
          .where(eq(processingTasks.id, taskId))
      })
      await publishTaskEvent({
        type: 'task.progress',
        taskId,
        videoId,
        accountId,
        progress: taskProgress,
        step: 'transcode_720',
        stepProgress: pct,
        at: new Date().toISOString(),
      })
    } catch (err) {
      // Progress is best-effort; never fail the job over a missed tick.
      console.error(`progress publish failed for task ${taskId}:`, err)
    }
  }

  const scratch = await makeScratch()
  try {
    const input = scratch.path('source')
    const output = scratch.path('out.mp4')
    await download(sourceKey, input)
    await transcode720(input, output, {
      timeoutMs: env.TRANSCODE_TIMEOUT_MS,
      durationSec,
      onProgress,
    })

    const buf = await readFile(output)
    await putObject(outKey, buf, 'video/mp4')

    await db.transaction(async (tx) => {
      await tx
        .insert(artifacts)
        .values({
          videoId,
          type: 'rendition',
          storageKey: outKey,
          mime: 'video/mp4',
          size: buf.length,
          attributes: { resolution: label },
          status: 'done',
        })
        .onConflictDoNothing({ target: artifacts.storageKey })
      await tx
        .update(taskSteps)
        .set({ status: 'done', progress: 100 })
        .where(and(eq(taskSteps.taskId, taskId), eq(taskSteps.type, 'transcode_720')))
    })

    await publishTaskEvent({
      type: 'artifact.created',
      taskId,
      videoId,
      accountId,
      artifactType: 'rendition',
      storageKey: outKey,
      at: new Date().toISOString(),
    })
  } finally {
    await scratch.cleanup()
  }
}
