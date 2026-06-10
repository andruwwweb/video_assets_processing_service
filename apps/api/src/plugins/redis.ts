import fp from 'fastify-plugin'
import { Redis } from 'ioredis'
import { loadEnv } from '@mpp/config'

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis
  }
}

/** Attaches an ioredis client to Fastify and closes it on shutdown. */
export const redisPlugin = fp(async (app) => {
  const env = loadEnv()
  // maxRetriesPerRequest: null is required by BullMQ; also safe for regular requests.
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
  app.decorate('redis', redis)
  app.addHook('onClose', async () => {
    await redis.quit()
  })
})
