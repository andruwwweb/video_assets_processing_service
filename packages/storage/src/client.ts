import { S3Client } from '@aws-sdk/client-s3'
import { loadEnv } from '@mpp/config'

/** Creates an S3 client from env. MinIO in dev uses path-style addressing. */
export function createS3Client(): S3Client {
  const env = loadEnv()
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    // AWS SDK v3 adds CRC32 checksums by default, which breaks presigned PUT
    // against MinIO / S3-compatible stores. Only compute/validate when required.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
}
