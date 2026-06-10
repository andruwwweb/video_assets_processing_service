import { Redis } from 'ioredis'
import { loadEnv } from '@mpp/config'

let cached: Redis | null = null

/** Shared ioredis connection for BullMQ producers (maxRetriesPerRequest must be null). */
export function getQueueConnection(): Redis {
  if (cached) return cached
  const env = loadEnv()
  cached = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
  return cached
}
