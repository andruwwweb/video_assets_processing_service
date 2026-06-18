import Fastify, { type FastifyInstance } from 'fastify'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { eq } from 'drizzle-orm'
import { loadEnv } from '@mpp/config'
import { apiKeyUsage, apiKeys } from '@mpp/db'
import { dbPlugin } from './plugins/db'
import { redisPlugin } from './plugins/redis'
import { queuePlugin } from './plugins/queue'
import { authPlugin } from './plugins/auth'
import { rateLimitPlugin } from './plugins/rate-limit'
import { errorHandlerPlugin } from './plugins/error-handler'
import { wsPlugin } from './plugins/ws'
import { healthRoutes } from './routes/health'
import { authRoutes } from './routes/auth'
import { keyRoutes } from './routes/keys'
import { webhookRoutes } from './routes/webhooks'
import { videoRoutes } from './routes/videos'
import { taskRoutes } from './routes/tasks'
import { wsRoutes } from './routes/ws'

/** Builds the Fastify instance with all plugins and routes. */
export function buildApp(): FastifyInstance {
  const env = loadEnv()

  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    // Trust the reverse proxy that terminates TLS.
    trustProxy: true,
  })

  // Zod is the single source: request/response validation + OpenAPI generation.
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  app.register(fastifySwagger, {
    openapi: {
      info: { title: 'Media Processing Platform API', version: '0.0.0' },
    },
    transform: jsonSchemaTransform,
  })
  if (env.API_DOCS_ENABLED) {
    app.register(fastifySwaggerUi, { routePrefix: '/docs' })
  }

  app.register(errorHandlerPlugin)
  app.register(dbPlugin)
  app.register(redisPlugin)
  app.register(queuePlugin)
  app.register(authPlugin)
  app.register(wsPlugin)

  app.register(healthRoutes)
  // Public auth (register/login open; me/logout guarded per-route).
  app.register(authRoutes, { prefix: '/v1' })

  // Account management — dashboard users only (JWT).
  app.register(async (mgmt) => {
    mgmt.addHook('onRequest', mgmt.requireUser)
    await mgmt.register(keyRoutes, { prefix: '/v1' })
    await mgmt.register(webhookRoutes, { prefix: '/v1' })
  })

  // Data API — API key or user JWT; rate-limited per key.
  app.register(async (data) => {
    await data.register(rateLimitPlugin)
    data.addHook('onRequest', data.requireData)
    // Usage history for key-authed requests (async, off the critical path).
    data.addHook('onResponse', async (req, reply) => {
      const a = req.auth
      if (a?.type !== 'key' || !a.apiKeyId) return
      const apiKeyId = a.apiKeyId
      const endpoint = req.url.split('?')[0]
      void app.db
        .insert(apiKeyUsage)
        .values({ apiKeyId, endpoint, statusCode: reply.statusCode, ip: req.ip })
        .catch(() => {})
      void app.db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, apiKeyId))
        .catch(() => {})
    })
    await data.register(videoRoutes, { prefix: '/v1' })
    await data.register(taskRoutes, { prefix: '/v1' })
    await data.register(wsRoutes, { prefix: '/v1' })
  })

  // Raw OpenAPI document for tooling/clients.
  app.get('/openapi.json', { schema: { hide: true } }, () => app.swagger())

  return app
}
