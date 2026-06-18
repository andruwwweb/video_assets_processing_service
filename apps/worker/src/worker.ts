import { and, eq } from 'drizzle-orm'
import { loadEnv } from '@mpp/config'
import { createDb, processingTasks, taskSteps, videos } from '@mpp/db'
import {
  JOB,
  QUEUE,
  makeWorker,
  publishTaskEvent,
  type FinalizeJobData,
  type Job,
  type ProbeJobData,
  type TranscodeJobData,
} from '@mpp/queue'
import { probeProcessor } from './processors/probe'
import { transcodeProcessor } from './processors/transcode'
import { finalizeProcessor } from './processors/finalize'

const env = loadEnv()
const { db, pool } = createDb(env.DATABASE_URL)

// Phase A: probe gate.
const probeWorker = makeWorker<ProbeJobData>(QUEUE.probe, (job) => probeProcessor(job, db))

// Phase B: transcode + finalize on the heavy queue, dispatched by job name.
const heavyWorker = makeWorker(QUEUE.mediaHeavy, async (job) => {
  switch (job.name) {
    case JOB.transcode720:
      return transcodeProcessor(job as Job<TranscodeJobData>, db)
    case JOB.finalize:
      return finalizeProcessor(job as Job<FinalizeJobData>, db)
    default:
      throw new Error(`unknown job on media-heavy: ${job.name}`)
  }
})

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
        .where(and(eq(taskSteps.taskId, taskId), eq(taskSteps.type, job.name)))
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
    }
  } catch (e) {
    console.error(`failed to record failure for task ${taskId}:`, e)
  }
}

for (const w of [probeWorker, heavyWorker]) {
  w.on('failed', (job, err) => void handleJobFailure(job, err))
  w.on('error', (err) => console.error(`worker error: ${err.message}`))
}

console.log('worker started: probe + media-heavy')

async function shutdown(signal: string): Promise<void> {
  console.log(`shutting down (${signal})`)
  await Promise.allSettled([probeWorker.close(), heavyWorker.close()])
  await pool.end()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
