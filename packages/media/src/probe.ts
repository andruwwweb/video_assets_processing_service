import type { VideoMetadata } from '@mpp/core'
import { run, type RunOptions } from './run'

interface FfprobeStream {
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
  r_frame_rate?: string
  display_aspect_ratio?: string
}

interface FfprobeOutput {
  streams?: FfprobeStream[]
  format?: { duration?: string; size?: string; bit_rate?: string }
}

/** Extracts metadata from a media file via `ffprobe` (JSON output). */
export async function ffprobe(input: string, opts: RunOptions): Promise<VideoMetadata> {
  const { stdout } = await run(
    'ffprobe',
    ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', input],
    opts,
  )
  const data = JSON.parse(stdout) as FfprobeOutput
  const video = data.streams?.find((s) => s.codec_type === 'video')
  const audio = data.streams?.find((s) => s.codec_type === 'audio')

  return {
    duration: toNum(data.format?.duration),
    size: toNum(data.format?.size),
    bitrate: toNum(data.format?.bit_rate),
    width: video?.width,
    height: video?.height,
    fps: parseFps(video?.r_frame_rate),
    videoCodec: video?.codec_name,
    audioCodec: audio?.codec_name,
    aspectRatio: video?.display_aspect_ratio,
  }
}

function toNum(v: string | undefined): number | undefined {
  if (v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/** ffprobe reports fps as a fraction like "30000/1001". */
function parseFps(r: string | undefined): number | undefined {
  if (!r) return undefined
  const [a, b] = r.split('/').map(Number)
  if (!a || !b) return undefined
  const fps = a / b
  return Number.isFinite(fps) ? Math.round(fps * 100) / 100 : undefined
}
