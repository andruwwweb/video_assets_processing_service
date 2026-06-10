import { readFile } from 'node:fs/promises'
import { and, eq } from 'drizzle-orm'
import { loadEnv } from '@mpp/config'
import { artifacts, taskSteps, type Database } from '@mpp/db'
import { transcode720 } from '@mpp/media'
import { putObject, renditionKey } from '@mpp/storage'
import { type Job, type TranscodeJobData } from '@mpp/queue'
import { download, makeScratch } from '../scratch'

/** Phase B leaf: transcode to 720p, upload, record the artifact (idempotent via unique key). */
export async function transcodeProcessor(job: Job<TranscodeJobData>, db: Database): Promise<void> {
  const { videoId, taskId, accountId, sourceKey, label } = job.data
  const env = loadEnv()
  const outKey = renditionKey(accountId, videoId, label)

  const scratch = await makeScratch()
  try {
    const input = scratch.path('source')
    const output = scratch.path('out.mp4')
    await download(sourceKey, input)
    await transcode720(input, output, { timeoutMs: env.TRANSCODE_TIMEOUT_MS })

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
  } finally {
    await scratch.cleanup()
  }
}
