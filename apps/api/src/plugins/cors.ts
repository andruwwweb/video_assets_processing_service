import fp from 'fastify-plugin'
import fastifyCors from '@fastify/cors'
import { loadEnv } from '@mpp/config'

/** CORS for the dashboard origin(s) with credentials (JWT cookie). */
export const corsPlugin = fp(async (app) => {
  const env = loadEnv()
  const origin = env.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  await app.register(fastifyCors, { origin, credentials: true })
})
