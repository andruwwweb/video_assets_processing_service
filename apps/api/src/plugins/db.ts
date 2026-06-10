import fp from 'fastify-plugin'
import { loadEnv } from '@mpp/config'
import { createDb, type Database, type DbHandle } from '@mpp/db'

declare module 'fastify' {
  interface FastifyInstance {
    db: Database
    // Pool type comes via @mpp/db so the api doesn't depend on pg/@types/pg directly.
    pgPool: DbHandle['pool']
  }
}

/** Attaches the drizzle client to Fastify and closes the pool on shutdown. */
export const dbPlugin = fp(async (app) => {
  const env = loadEnv()
  const { db, pool } = createDb(env.DATABASE_URL)
  app.decorate('db', db)
  app.decorate('pgPool', pool)
  app.addHook('onClose', async () => {
    await pool.end()
  })
})
