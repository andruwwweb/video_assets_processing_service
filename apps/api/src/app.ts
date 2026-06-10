import Fastify, { type FastifyInstance } from 'fastify'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { loadEnv } from '@mpp/config'
import { dbPlugin } from './plugins/db'
import { redisPlugin } from './plugins/redis'
import { queuePlugin } from './plugins/queue'
import { devAccountPlugin } from './plugins/dev-account'
import { errorHandlerPlugin } from './plugins/error-handler'
import { healthRoutes } from './routes/health'
import { videoRoutes } from './routes/videos'
import { taskRoutes } from './routes/tasks'

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
  app.register(devAccountPlugin)

  app.register(healthRoutes)
  app.register(videoRoutes, { prefix: '/v1' })
  app.register(taskRoutes, { prefix: '/v1' })

  // Raw OpenAPI document for tooling/clients.
  app.get('/openapi.json', { schema: { hide: true } }, () => app.swagger())

  return app
}
