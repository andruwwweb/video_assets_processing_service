import { run, type RunOptions } from './run'

/** Extracts the audio track to MP3 (libmp3lame VBR ~190kbps, no video). */
export async function extractAudioMp3(
  input: string,
  output: string,
  opts: RunOptions,
): Promise<void> {
  await run(
    'ffmpeg',
    ['-y', '-i', input, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', output],
    opts,
  )
}
