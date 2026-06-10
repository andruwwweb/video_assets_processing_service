import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Readable } from 'node:stream'
import { loadEnv } from '@mpp/config'
import { createS3Client } from './client'

export { createS3Client }
export * from './keys'

let cached: S3Client | null = null
function client(): S3Client {
  if (!cached) cached = createS3Client()
  return cached
}

function bucket(): string {
  return loadEnv().S3_BUCKET
}

/** Presigned PUT URL for direct client upload (bypasses the API). */
export function presignPut(key: string, contentType?: string): Promise<string> {
  const env = loadEnv()
  const cmd = new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType })
  return getSignedUrl(client(), cmd, { expiresIn: env.PRESIGN_PUT_TTL_SECONDS })
}

/** Presigned GET URL for direct client download. */
export function presignGet(key: string): Promise<string> {
  const env = loadEnv()
  const cmd = new GetObjectCommand({ Bucket: bucket(), Key: key })
  return getSignedUrl(client(), cmd, { expiresIn: env.PRESIGN_GET_TTL_SECONDS })
}

/** True if the object exists — used to confirm an upload on `complete`. */
export async function objectExists(key: string): Promise<boolean> {
  try {
    await client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
    return true
  } catch {
    return false
  }
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string,
): Promise<void> {
  await client().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
  )
}

/** Downloads an object as a readable stream (used by the worker on stage 2b). */
export async function getObjectStream(key: string): Promise<Readable> {
  const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }))
  return res.Body as Readable
}

/** Recursively deletes every object under a prefix (e.g. on video deletion). */
export async function deletePrefix(prefix: string): Promise<void> {
  let token: string | undefined
  do {
    const listed = await client().send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }),
    )
    const objects = (listed.Contents ?? []).map((o) => ({ Key: o.Key! }))
    if (objects.length > 0) {
      await client().send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: objects } }))
    }
    token = listed.IsTruncated ? listed.NextContinuationToken : undefined
  } while (token)
}
