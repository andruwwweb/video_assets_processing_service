/**
 * Storage key layout, namespaced per tenant + video (architecture §11).
 * Every key is prefixed with the account id for multi-tenant isolation.
 */

export function videoPrefix(accountId: string, videoId: string): string {
  return `${accountId}/${videoId}`
}

/** Key of the uploaded original; `ext` without leading dot. */
export function originalKey(accountId: string, videoId: string, ext: string): string {
  const clean = ext.replace(/^\.+/, '').toLowerCase()
  return `${videoPrefix(accountId, videoId)}/original/source.${clean}`
}

/** Key of a transcoded rendition, e.g. label "720p". */
export function renditionKey(accountId: string, videoId: string, label: string): string {
  return `${videoPrefix(accountId, videoId)}/renditions/${label}.mp4`
}

/** Single poster thumbnail. */
export function thumbnailKey(accountId: string, videoId: string): string {
  return `${videoPrefix(accountId, videoId)}/thumbnails/thumb_0001.jpg`
}

/** One extracted frame; `index` is 1-based. */
export function frameKey(accountId: string, videoId: string, index: number): string {
  return `${videoPrefix(accountId, videoId)}/frames/frame_${String(index).padStart(4, '0')}.jpg`
}

/** Short demo clip. */
export function clipKey(accountId: string, videoId: string): string {
  return `${videoPrefix(accountId, videoId)}/clip/clip.mp4`
}

/** Extracted audio track; `ext` without leading dot (e.g. "mp3"). */
export function audioKey(accountId: string, videoId: string, ext: string): string {
  const clean = ext.replace(/^\.+/, '').toLowerCase()
  return `${videoPrefix(accountId, videoId)}/audio/audio.${clean}`
}

/** Any file in the HLS output (master/variant playlists + segments), by filename. */
export function hlsFileKey(accountId: string, videoId: string, filename: string): string {
  return `${videoPrefix(accountId, videoId)}/hls/${filename}`
}

/** The HLS master playlist (the artifact's canonical key). */
export function hlsMasterKey(accountId: string, videoId: string): string {
  return hlsFileKey(accountId, videoId, 'master.m3u8')
}
