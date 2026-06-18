import { mkdir, readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { loadEnv } from '@mpp/config'
import { type Database } from '@mpp/db'
import { ffprobe, packageHls, type HlsVariant } from '@mpp/media'
import { hlsFileKey, hlsMasterKey, putObject, renditionKey } from '@mpp/storage'
import { type HlsJobData, type Job } from '@mpp/queue'
import { download, makeScratch } from '../scratch'
import { recordArtifact } from '../artifacts'
import { reportProgress } from '../progress'

function hlsContentType(name: string): string {
  if (name.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl'
  if (name.endsWith('.ts')) return 'video/mp2t'
  return 'application/octet-stream'
}

/**
 * Heavy fan-in: packages the finished renditions into an ABR HLS tree
 * (stream-copy segmenting + master playlist) and uploads it. One artifact row
 * (the master); segments live in storage under the hls/ prefix.
 */
export async function hlsProcessor(job: Job<HlsJobData>, db: Database): Promise<void> {
  const { videoId, taskId, accountId, labels } = job.data
  const env = loadEnv()

  const scratch = await makeScratch()
  try {
    const outDir = scratch.path('hls')
    await mkdir(outDir, { recursive: true })

    const variants: HlsVariant[] = []
    for (const label of labels) {
      const file = scratch.path(`${label}.mp4`)
      await download(renditionKey(accountId, videoId, label), file)
      const meta = await ffprobe(file, { timeoutMs: env.MEDIA_LIGHT_TIMEOUT_MS })
      const size = (await stat(file)).size
      const duration = meta.duration ?? 0
      const bandwidth = meta.bitrate ?? (duration > 0 ? Math.round((size * 8) / duration) : 0)
      variants.push({ label, input: file, width: meta.width ?? 0, height: meta.height ?? 0, bandwidth })
    }

    const { files } = await packageHls(variants, outDir, { timeoutMs: env.TRANSCODE_TIMEOUT_MS })

    let masterSize = 0
    for (const f of files) {
      const name = basename(f)
      const buf = await readFile(f)
      if (name === 'master.m3u8') masterSize = buf.length
      await putObject(hlsFileKey(accountId, videoId, name), buf, hlsContentType(name))
    }

    await recordArtifact(db, {
      videoId,
      taskId,
      accountId,
      type: 'hls',
      storageKey: hlsMasterKey(accountId, videoId),
      mime: 'application/vnd.apple.mpegurl',
      size: masterSize,
      attributes: { variants: labels },
    })
    await reportProgress(db, { videoId, taskId, accountId, step: 'hls', stepProgress: 100, markDone: true })
  } finally {
    await scratch.cleanup()
  }
}
