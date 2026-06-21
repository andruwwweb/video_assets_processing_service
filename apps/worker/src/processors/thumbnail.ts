import { readFile } from 'node:fs/promises'
import { loadEnv } from '@mpp/config'
import { type Database } from '@mpp/db'
import { thumbnail } from '@mpp/media'
import { putObject, thumbnailKey } from '@mpp/storage'
import { type Job, type ThumbnailJobData } from '@mpp/queue'
import { download, makeScratch } from '../scratch'
import { recordArtifact } from '../artifacts'
import { reportProgress } from '../progress'
import { isTaskActive } from '../cancel'

/** Light leaf: single poster thumbnail at `atSec`. */
export async function thumbnailProcessor(job: Job<ThumbnailJobData>, db: Database): Promise<void> {
  const { videoId, taskId, accountId, sourceKey, atSec } = job.data
  if (!(await isTaskActive(db, taskId))) return // cancelled or video deleted
  const env = loadEnv()
  const outKey = thumbnailKey(accountId, videoId)

  const scratch = await makeScratch()
  try {
    const input = scratch.path('source')
    const output = scratch.path('thumb.jpg')
    await download(sourceKey, input)
    await thumbnail(input, output, { atSec, timeoutMs: env.MEDIA_LIGHT_TIMEOUT_MS })

    const buf = await readFile(output)
    await putObject(outKey, buf, 'image/jpeg')
    await recordArtifact(db, {
      videoId,
      taskId,
      accountId,
      type: 'thumbnail',
      storageKey: outKey,
      mime: 'image/jpeg',
      size: buf.length,
      attributes: { atSec },
    })
    await reportProgress(db, { videoId, taskId, accountId, step: 'thumbnail', stepProgress: 100, markDone: true })
  } finally {
    await scratch.cleanup()
  }
}
