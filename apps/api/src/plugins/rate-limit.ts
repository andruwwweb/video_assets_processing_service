import fp from 'fastify-plugin'
import fastifyRateLimit from '@fastify/rate-limit'
import { loadEnv } from '@mpp/config'
import { hashApiKey, isApiKey } from '../lib/auth'

/**
 * Per-API-key rate limit (architecture §15) with a Redis store shared across
 * API instances. `fp` so it attaches to the data-API scope that registers it
 * (not a child context), thereby covering that scope's routes — but no others.
 */
export const rateLimitPlugin = fp(async (app) => {
  const env = loadEnv()
  await app.register(fastifyRateLimit, {
    redis: app.redis,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_SECONDS * 1000,
    keyGenerator: (req) => {
      const header = req.headers.authorization
      const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined
      const q = req.query as { token?: unknown } | undefined
      const token = bearer ?? (typeof q?.token === 'string' ? q.token : undefined)
      if (token && isApiKey(token)) return `k:${hashApiKey(token)}`
      return `ip:${req.ip}`
    },
    // Default rejection throws a 429 error → the shared error handler formats it
    // (RATE_LIMITED envelope). Retry-After / X-RateLimit-* headers are set by the plugin.
  })
})
