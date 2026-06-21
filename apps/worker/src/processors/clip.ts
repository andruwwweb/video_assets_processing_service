import { readFile } from 'node:fs/promises'
import { loadEnv } from '@mpp/config'
import { type Database } from '@mpp/db'
import { makeClip } from '@mpp/media'
import { clipKey, putObject } from '@mpp/storage'
import { type ClipJobData, type Job } from '@mpp/queue'
import { download, makeScratch } from '../scratch'
import { recordArtifact } from '../artifacts'
import { reportProgress } from '../progress'
import { isTaskActive } from '../cancel'

/** Light leaf: short demo clip. */
export async function clipProcessor(job: Job<ClipJobData>, db: Database): Promise<void> {
  const { videoId, taskId, accountId, sourceKey, startSec, durationSec, height } = job.data
  if (!(await isTaskActive(db, taskId))) return // cancelled or video deleted
  const env = loadEnv()
  const outKey = clipKey(accountId, videoId)

  const scratch = await makeScratch()
  try {
    const input = scratch.path('source')
    const output = scratch.path('clip.mp4')
    await download(sourceKey, input)
    await makeClip(input, output, { startSec, durationSec, height, timeoutMs: env.MEDIA_LIGHT_TIMEOUT_MS })

    const buf = await readFile(output)
    await putObject(outKey, buf, 'video/mp4')
    await recordArtifact(db, {
      videoId,
      taskId,
      accountId,
      type: 'clip',
      storageKey: outKey,
      mime: 'video/mp4',
      size: buf.length,
      attributes: { startSec, durationSec, height },
    })
    await reportProgress(db, { videoId, taskId, accountId, step: 'clip', stepProgress: 100, markDone: true })
  } finally {
    await scratch.cleanup()
  }
}
