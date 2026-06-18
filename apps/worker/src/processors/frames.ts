import { mkdir, readFile } from 'node:fs/promises'
import { loadEnv } from '@mpp/config'
import { type Database } from '@mpp/db'
import { extractFrames } from '@mpp/media'
import { frameKey, putObject } from '@mpp/storage'
import { type FramesJobData, type Job } from '@mpp/queue'
import { download, makeScratch } from '../scratch'
import { recordArtifact } from '../artifacts'
import { reportProgress } from '../progress'

/** Light leaf: frames every `intervalSec`; one artifact row per frame. */
export async function framesProcessor(job: Job<FramesJobData>, db: Database): Promise<void> {
  const { videoId, taskId, accountId, sourceKey, intervalSec } = job.data
  const env = loadEnv()

  const scratch = await makeScratch()
  try {
    const input = scratch.path('source')
    const outDir = scratch.path('frames')
    await mkdir(outDir, { recursive: true })
    await download(sourceKey, input)
    const files = await extractFrames(input, outDir, { intervalSec, timeoutMs: env.MEDIA_LIGHT_TIMEOUT_MS })

    for (let i = 0; i < files.length; i++) {
      const buf = await readFile(files[i])
      const key = frameKey(accountId, videoId, i + 1)
      await putObject(key, buf, 'image/jpeg')
      await recordArtifact(db, {
        videoId,
        taskId,
        accountId,
        type: 'frames',
        storageKey: key,
        mime: 'image/jpeg',
        size: buf.length,
        attributes: { index: i + 1, atSec: i * intervalSec },
      })
    }
    await reportProgress(db, { videoId, taskId, accountId, step: 'frames', stepProgress: 100, markDone: true })
  } finally {
    await scratch.cleanup()
  }
}
