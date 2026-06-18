import { readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { run, type RunOptions } from './run'

export interface HlsVariant {
  /** Rendition label, e.g. "720p" — used for playlist/segment names. */
  label: string
  /** Path to the rendition mp4 to segment. */
  input: string
  width: number
  height: number
  /** Average bitrate (bps) for the master BANDWIDTH attribute. */
  bandwidth: number
}

export interface HlsResult {
  masterPath: string
  /** All produced files (master + variant playlists + segments). */
  files: string[]
}

/**
 * Packages renditions into an ABR HLS tree: each variant is segmented by
 * stream-copy (no re-encode), then a master.m3u8 references all variants.
 */
export async function packageHls(
  variants: HlsVariant[],
  outDir: string,
  opts: RunOptions,
): Promise<HlsResult> {
  for (const v of variants) {
    await run(
      'ffmpeg',
      [
        '-y',
        '-i', v.input,
        '-c', 'copy',
        '-f', 'hls',
        '-hls_time', '6',
        '-hls_playlist_type', 'vod',
        '-hls_segment_filename', join(outDir, `${v.label}_%03d.ts`),
        join(outDir, `${v.label}.m3u8`),
      ],
      opts,
    )
  }

  const lines = ['#EXTM3U', '#EXT-X-VERSION:3']
  for (const v of variants) {
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${v.bandwidth},RESOLUTION=${v.width}x${v.height}`)
    lines.push(`${v.label}.m3u8`)
  }
  const masterPath = join(outDir, 'master.m3u8')
  await writeFile(masterPath, lines.join('\n') + '\n')

  const files = (await readdir(outDir)).map((f) => join(outDir, f))
  return { masterPath, files }
}
