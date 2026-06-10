import { run, type RunOptions } from './run'

/** Transcodes the input into a 720p H.264/AAC MP4 (faststart for progressive play). */
export async function transcode720(input: string, output: string, opts: RunOptions): Promise<void> {
  await run(
    'ffmpeg',
    [
      '-y',
      '-i', input,
      '-vf', 'scale=-2:720',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      output,
    ],
    opts,
  )
}
