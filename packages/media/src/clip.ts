import { run, type RunOptions } from './run'

export interface ClipOptions extends RunOptions {
  /** Start offset (seconds). */
  startSec: number
  /** Clip length (seconds). */
  durationSec: number
  /** Target height (px). */
  height: number
}

/** Cuts a short demo clip [startSec, startSec+durationSec) at the given height. */
export async function makeClip(input: string, output: string, opts: ClipOptions): Promise<void> {
  const { startSec, durationSec, height, ...runOpts } = opts
  await run(
    'ffmpeg',
    [
      '-y',
      '-ss', String(startSec),
      '-i', input,
      '-t', String(durationSec),
      '-vf', `scale=-2:${height}`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      output,
    ],
    runOpts,
  )
}
