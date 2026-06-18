import { and, eq } from 'drizzle-orm'
import { loadEnv } from '@mpp/config'
import { createDb, processingTasks, taskSteps, videos } from '@mpp/db'
import {
  JOB,
  QUEUE,
  enqueueWebhookEvent,
  makeWorker,
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
import { probeProcessor } from './processors/probe'
import { thumbnailProcessor } from './processors/thumbnail'
import { framesProcessor } from './processors/frames'
import { clipProcessor } from './processors/clip'
import { audioProcessor } from './processors/audio'
import { renditionProcessor } from './processors/rendition'
import { hlsProcessor } from './processors/hls'
import { finalizeProcessor } from './processors/finalize'

// Per-worker concurrency tuned to load class (architecture §5).
const LIGHT_CONCURRENCY = 3
const HEAVY_CONCURRENCY = 2

const env = loadEnv()
const { db, pool } = createDb(env.DATABASE_URL)

// Phase A: probe gate.
const probeWorker = makeWorker<ProbeJobData>(QUEUE.probe, (job) => probeProcessor(job, db))

// Phase B leaves on media-light, dispatched by job name.
const lightWorker = makeWorker(
  QUEUE.mediaLight,
  async (job) => {
    switch (job.name) {
      case JOB.thumbnail:
        return thumbnailProcessor(job as Job<ThumbnailJobData>, db)
      case JOB.frames:
        return framesProcessor(job as Job<FramesJobData>, db)
      case JOB.clip:
        return clipProcessor(job as Job<ClipJobData>, db)
      case JOB.audio:
        return audioProcessor(job as Job<AudioJobData>, db)
      default:
        throw new Error(`unknown job on media-light: ${job.name}`)
    }
  },
  { concurrency: LIGHT_CONCURRENCY },
)

// Phase B heavy work + fan-in + root on media-heavy.
const heavyWorker = makeWorker(
  QUEUE.mediaHeavy,
  async (job) => {
    switch (job.name) {
      case JOB.rendition:
        return renditionProcessor(job as Job<RenditionJobData>, db)
      case JOB.hls:
        return hlsProcessor(job as Job<HlsJobData>, db)
      case JOB.finalize:
        return finalizeProcessor(job as Job<FinalizeJobData>, db)
      default:
        throw new Error(`unknown job on media-heavy: ${job.name}`)
    }
  },
  { concurrency: HEAVY_CONCURRENCY },
)

/** Step type for a job (renditions carry their height in the type). */
function stepTypeOf(job: Job): string {
  if (job.name === JOB.rendition) return `rendition_${(job.data as RenditionJobData).height}`
  return job.name
}

/** On a job's final failure (retries exhausted), mark task/video/step failed (architecture §9, §16). */
async function handleJobFailure(job: Job | undefined, err: Error): Promise<void> {
  console.error(`job failed: ${job?.name} ${job?.id}: ${err.message}`)
  if (!job) return
  const maxAttempts = job.opts.attempts ?? 1
  if (job.attemptsMade < maxAttempts) return // a retry is still pending

  const { videoId, taskId, accountId } = job.data as {
    videoId?: string
    taskId?: string
    accountId?: string
  }
  if (!videoId || !taskId) return
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(processingTasks)
        .set({ status: 'failed', error: err.message, finishedAt: new Date() })
        .where(eq(processingTasks.id, taskId))
      await tx.update(videos).set({ status: 'failed' }).where(eq(videos.id, videoId))
      await tx
        .update(taskSteps)
        .set({ status: 'failed', error: err.message })
        .where(and(eq(taskSteps.taskId, taskId), eq(taskSteps.type, stepTypeOf(job))))
    })
    if (accountId) {
      await publishTaskEvent({
        type: 'task.failed',
        taskId,
        videoId,
        accountId,
        error: err.message,
        at: new Date().toISOString(),
      })
      await enqueueWebhookEvent({
        accountId,
        event: 'processing.failed',
        payload: { videoId, taskId, error: err.message },
      })
    }
  } catch (e) {
    console.error(`failed to record failure for task ${taskId}:`, e)
  }
}

const workers = [probeWorker, lightWorker, heavyWorker]
for (const w of workers) {
  w.on('failed', (job, err) => void handleJobFailure(job, err))
  w.on('error', (err) => console.error(`worker error: ${err.message}`))
}

console.log('worker started: probe + media-light + media-heavy')

async function shutdown(signal: string): Promise<void> {
  console.log(`shutting down (${signal})`)
  await Promise.allSettled(workers.map((w) => w.close()))
  await pool.end()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
