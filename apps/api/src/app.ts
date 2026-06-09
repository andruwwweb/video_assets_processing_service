import Fastify, { type FastifyInstance } from 'fastify'
import { loadEnv } from '@mpp/config'
import { dbPlugin } from './plugins/db'
import { redisPlugin } from './plugins/redis'
import { healthRoutes } from './routes/health'

/** Собирает экземпляр Fastify со всеми плагинами и маршрутами. */
export function buildApp(): FastifyInstance {
  const env = loadEnv()

  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    // Доверяем заголовкам прокси (TLS-терминация на reverse proxy).
    trustProxy: true,
  })

  app.register(dbPlugin)
  app.register(redisPlugin)
  app.register(healthRoutes)

  return app
}
