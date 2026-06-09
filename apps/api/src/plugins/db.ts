import fp from 'fastify-plugin'
import { loadEnv } from '@mpp/config'
import { createDb, type Database, type DbHandle } from '@mpp/db'

declare module 'fastify' {
  interface FastifyInstance {
    db: Database
    // Тип пула берём через @mpp/db, чтобы api не зависел напрямую от pg/@types/pg.
    pgPool: DbHandle['pool']
  }
}

/** Подключает drizzle-клиент к Fastify и закрывает пул при остановке. */
export const dbPlugin = fp(async (app) => {
  const env = loadEnv()
  const { db, pool } = createDb(env.DATABASE_URL)
  app.decorate('db', db)
  app.decorate('pgPool', pool)
  app.addHook('onClose', async () => {
    await pool.end()
  })
})
