import fp from 'fastify-plugin'
import { loadEnv } from '@mpp/config'

declare module 'fastify' {
  interface FastifyRequest {
    accountId: string
  }
}

/** Stage 2a has no auth: every request is scoped to the fixed dev account. */
export const devAccountPlugin = fp(async (app) => {
  const env = loadEnv()
  app.decorateRequest('accountId', '')
  app.addHook('onRequest', async (req) => {
    req.accountId = env.DEV_ACCOUNT_ID
  })
})
