import { readFile } from 'node:fs/promises'
import { loadEnv } from '@mpp/config'
import { type Database } from '@mpp/db'
import { extractAudioMp3 } from '@mpp/media'
import { audioKey, putObject } from '@mpp/storage'
import { type AudioJobData, type Job } from '@mpp/queue'
import { download, makeScratch } from '../scratch'
import { recordArtifact } from '../artifacts'
import { reportProgress } from '../progress'

/** Light leaf: extract the audio track to MP3. */
export async function audioProcessor(job: Job<AudioJobData>, db: Database): Promise<void> {
  const { videoId, taskId, accountId, sourceKey } = job.data
  const env = loadEnv()
  const outKey = audioKey(accountId, videoId, 'mp3')

  const scratch = await makeScratch()
  try {
    const input = scratch.path('source')
    const output = scratch.path('audio.mp3')
    await download(sourceKey, input)
    await extractAudioMp3(input, output, { timeoutMs: env.MEDIA_LIGHT_TIMEOUT_MS })

    const buf = await readFile(output)
    await putObject(outKey, buf, 'audio/mpeg')
    await recordArtifact(db, {
      videoId,
      taskId,
      accountId,
      type: 'audio',
      storageKey: outKey,
      mime: 'audio/mpeg',
      size: buf.length,
      attributes: { format: 'mp3' },
    })
    await reportProgress(db, { videoId, taskId, accountId, step: 'audio', stepProgress: 100, markDone: true })
  } finally {
    await scratch.cleanup()
  }
}
