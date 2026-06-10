import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // Liveness: the process is up. No dependency checks.
  app.get('/health', async () => ({ status: 'ok' }))

  // Readiness: actually checks PostgreSQL and Redis availability.
  app.get('/ready', async (_req, reply) => {
    const checks: Record<'postgres' | 'redis', 'ok' | 'fail'> = {
      postgres: 'fail',
      redis: 'fail',
    }

    try {
      await app.db.execute(sql`select 1`)
      checks.postgres = 'ok'
    } catch (err) {
      app.log.error({ err }, 'postgres readiness check failed')
    }

    try {
      const pong = await app.redis.ping()
      checks.redis = pong === 'PONG' ? 'ok' : 'fail'
    } catch (err) {
      app.log.error({ err }, 'redis readiness check failed')
    }

    const ready = checks.postgres === 'ok' && checks.redis === 'ok'
    reply.code(ready ? 200 : 503)
    return { status: ready ? 'ready' : 'not_ready', checks }
  })
}
