import { readFile } from 'node:fs/promises'
import { loadEnv } from '@mpp/config'
import { type Database } from '@mpp/db'
import { transcode } from '@mpp/media'
import { putObject, renditionKey } from '@mpp/storage'
import { type Job, type RenditionJobData } from '@mpp/queue'
import { download, makeScratch } from '../scratch'
import { recordArtifact } from '../artifacts'
import { reportProgress } from '../progress'

// Throttle live progress: at most every interval, but always on a big jump.
const PROGRESS_THROTTLE_MS = 1000
const PROGRESS_MIN_DELTA = 5

/** Heavy leaf: transcode one rendition (live progress), upload, record artifact. */
export async function renditionProcessor(job: Job<RenditionJobData>, db: Database): Promise<void> {
  const { videoId, taskId, accountId, sourceKey, label, height, durationSec } = job.data
  const env = loadEnv()
  const outKey = renditionKey(accountId, videoId, label)
  const step = `rendition_${height}`

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
    void reportProgress(db, { videoId, taskId, accountId, step, stepProgress: pct })
      .catch((e) => console.error(`progress ${step} for task ${taskId}:`, e))
      .finally(() => {
        publishing = false
      })
  }

  const scratch = await makeScratch()
  try {
    const input = scratch.path('source')
    const output = scratch.path('out.mp4')
    await download(sourceKey, input)
    await transcode(input, output, {
      height,
      durationSec,
      onProgress,
      timeoutMs: env.TRANSCODE_TIMEOUT_MS,
    })

    const buf = await readFile(output)
    await putObject(outKey, buf, 'video/mp4')
    await recordArtifact(db, {
      videoId,
      taskId,
      accountId,
      type: 'rendition',
      storageKey: outKey,
      mime: 'video/mp4',
      size: buf.length,
      attributes: { resolution: label, height },
    })
    await reportProgress(db, { videoId, taskId, accountId, step, stepProgress: 100, markDone: true })
  } finally {
    await scratch.cleanup()
  }
}
