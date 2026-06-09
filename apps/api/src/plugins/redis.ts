import fp from 'fastify-plugin'
import { Redis } from 'ioredis'
import { loadEnv } from '@mpp/config'

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis
  }
}

/** Подключает ioredis-клиент к Fastify и закрывает его при остановке. */
export const redisPlugin = fp(async (app) => {
  const env = loadEnv()
  // maxRetriesPerRequest: null — требование BullMQ; здесь же безопасно и для обычных запросов.
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
  app.decorate('redis', redis)
  app.addHook('onClose', async () => {
    await redis.quit()
  })
})
