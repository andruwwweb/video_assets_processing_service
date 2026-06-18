import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { run, type RunOptions } from './run'

export interface ThumbnailOptions extends RunOptions {
  /** Timestamp (seconds) to grab the poster frame at. */
  atSec: number
  /** Output width (px); height auto. */
  width?: number
}

/** Grabs a single poster frame at `atSec` into a JPEG. */
export async function thumbnail(
  input: string,
  output: string,
  opts: ThumbnailOptions,
): Promise<void> {
  const { atSec, width = 640, ...runOpts } = opts
  // -ss before -i = fast (keyframe) seek.
  await run(
    'ffmpeg',
    ['-y', '-ss', String(atSec), '-i', input, '-frames:v', '1', '-vf', `scale=${width}:-2`, output],
    runOpts,
  )
}

export interface FramesOptions extends RunOptions {
  /** One frame every `intervalSec` seconds. */
  intervalSec: number
  width?: number
}

/**
 * Extracts frames every `intervalSec` into `outDir` (frame_0001.jpg, ...).
 * `outDir` must already exist. Returns the produced file paths in order.
 */
export async function extractFrames(
  input: string,
  outDir: string,
  opts: FramesOptions,
): Promise<string[]> {
  const { intervalSec, width = 640, ...runOpts } = opts
  await run(
    'ffmpeg',
    ['-y', '-i', input, '-vf', `fps=1/${intervalSec},scale=${width}:-2`, join(outDir, 'frame_%04d.jpg')],
    runOpts,
  )
  const files = (await readdir(outDir))
    .filter((f) => f.startsWith('frame_') && f.endsWith('.jpg'))
    .sort()
  return files.map((f) => join(outDir, f))
}
