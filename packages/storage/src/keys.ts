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
