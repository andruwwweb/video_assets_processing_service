import { run, type RunOptions } from './run'

export interface TranscodeOptions extends RunOptions {
  /** Target height in px; width is auto (keeps aspect, kept even by scale=-2). */
  height: number
  /** Source duration (seconds), from probe; required to derive live percent. */
  durationSec?: number
  /** Receives transcode percent (0..100) as ffmpeg progresses. */
  onProgress?: (pct: number) => void
}

/**
 * Parses one ffmpeg `-progress` line into a percent 0..100, or null if the line
 * carries no progress. Caps at 99 until `progress=end` so 100 means "finished".
 */
function parseProgressLine(line: string, durationSec: number): number | null {
  if (line.startsWith('progress=')) {
    return line.slice('progress='.length).trim() === 'end' ? 100 : null
  }
  if (line.startsWith('out_time_us=')) {
    const us = Number(line.slice('out_time_us='.length))
    if (!Number.isFinite(us) || us < 0) return null // "N/A" early on
    const pct = (us / 1_000_000 / durationSec) * 100
    return Math.max(0, Math.min(99, Math.round(pct)))
  }
  return null
}

/** Transcodes the input into an H.264/AAC MP4 at the given height (faststart). */
export async function transcode(
  input: string,
  output: string,
  opts: TranscodeOptions,
): Promise<void> {
  const { height, durationSec, onProgress, ...runOpts } = opts

  let onStdoutLine: ((line: string) => void) | undefined
  if (durationSec && durationSec > 0 && onProgress) {
    onStdoutLine = (line) => {
      const pct = parseProgressLine(line, durationSec)
      if (pct !== null) onProgress(pct)
    }
  }

  await run(
    'ffmpeg',
    [
      '-y',
      '-i', input,
      '-vf', `scale=-2:${height}`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      // Machine-readable progress on stdout; suppress the human stats stream.
      '-progress', 'pipe:1',
      '-nostats',
      output,
    ],
    { ...runOpts, onStdoutLine },
  )
}
