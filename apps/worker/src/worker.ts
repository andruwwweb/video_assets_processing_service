import { loadEnv } from '@mpp/config'
import { createDb } from '@mpp/db'
import { JOB, QUEUE, makeWorker, type Job, type FinalizeJobData, type ProbeJobData, type TranscodeJobData } from '@mpp/queue'
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

for (const w of [probeWorker, heavyWorker]) {
  w.on('failed', (job, err) => console.error(`job failed: ${job?.name} ${job?.id}: ${err.message}`))
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
