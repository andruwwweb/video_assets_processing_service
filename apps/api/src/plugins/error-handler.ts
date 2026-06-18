import fp from 'fastify-plugin'
import type { FastifyError } from 'fastify'

/** Unified error envelope `{ error: { code, message, details } }` + a correlation id header. */
export const errorHandlerPlugin = fp(async (app) => {
  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id)
  })

  app.setErrorHandler((err: FastifyError, req, reply) => {
    const status = err.statusCode ?? 500
    if (status >= 500) req.log.error({ err }, 'request failed')
    const code =
      status === 429
        ? 'RATE_LIMITED'
        : (err.code ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST'))
    reply.code(status).send({
      error: {
        code,
        message: err.message,
        // Fastify attaches `validation` for schema (Zod) failures.
        details: err.validation ?? null,
      },
    })
  })
})
