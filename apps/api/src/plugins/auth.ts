import fp from 'fastify-plugin'
import fastifyCookie from '@fastify/cookie'
import fastifyJwt from '@fastify/jwt'
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { loadEnv } from '@mpp/config'
import { apiKeys } from '@mpp/db'
import { hashApiKey, isApiKey } from '../lib/auth'

export interface AuthContext {
  accountId: string
  type: 'user' | 'key'
  userId?: string
  apiKeyId?: string
}

type Guard = (req: FastifyRequest, reply: FastifyReply) => Promise<void>

declare module 'fastify' {
  interface FastifyRequest {
    accountId: string
    auth: AuthContext | null
  }
  interface FastifyInstance {
    requireUser: Guard
    requireData: Guard
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { accountId: string; userId: string }
    user: { accountId: string; userId: string }
  }
}

function unauthorized(reply: FastifyReply, message: string): void {
  reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message, details: null } })
}

/**
 * Auth layer (architecture §12): two contexts → one account.
 * - API clients: `Authorization: Bearer mpp_live_...` (or `?token=` for WS) → SHA-256 lookup.
 * - Dashboard users: JWT (httpOnly cookie or Bearer) → { userId, accountId }.
 * Key resolution is cached in Redis (short TTL); invalidated on disable/delete.
 */
export const authPlugin = fp(async (app) => {
  const env = loadEnv()
  await app.register(fastifyCookie)
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: 'token', signed: false },
  })

  app.decorateRequest('accountId', '')
  app.decorateRequest('auth', null)

  async function resolveApiKey(key: string): Promise<{ accountId: string; apiKeyId: string } | null> {
    const cacheKey = `apikey:${hashApiKey(key)}`
    const cached = await app.redis.get(cacheKey)
    if (cached) {
      if (cached === 'miss') return null
      const [accountId, apiKeyId] = cached.split('|')
      return { accountId, apiKeyId }
    }
    const [row] = await app.db
      .select({ id: apiKeys.id, accountId: apiKeys.accountId, status: apiKeys.status })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, hashApiKey(key)))
      .limit(1)
    const ttl = env.API_KEY_CACHE_TTL_SECONDS
    if (!row || row.status !== 'active') {
      await app.redis.set(cacheKey, 'miss', 'EX', ttl)
      return null
    }
    await app.redis.set(cacheKey, `${row.accountId}|${row.id}`, 'EX', ttl)
    return { accountId: row.accountId, apiKeyId: row.id }
  }

  async function resolve(req: FastifyRequest): Promise<AuthContext | null> {
    const header = req.headers.authorization
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined
    const q = req.query as { token?: unknown } | undefined
    const token = bearer ?? (typeof q?.token === 'string' ? q.token : undefined)

    if (token && isApiKey(token)) {
      const r = await resolveApiKey(token)
      return r ? { accountId: r.accountId, type: 'key', apiKeyId: r.apiKeyId } : null
    }
    try {
      const p = await req.jwtVerify<{ accountId: string; userId: string }>()
      return { accountId: p.accountId, type: 'user', userId: p.userId }
    } catch {
      return null
    }
  }

  app.decorate('requireData', async (req, reply) => {
    const a = await resolve(req)
    if (!a) return unauthorized(reply, 'API key or login required')
    req.accountId = a.accountId
    req.auth = a
  })

  app.decorate('requireUser', async (req, reply) => {
    const a = await resolve(req)
    if (!a || a.type !== 'user') return unauthorized(reply, 'login required')
    req.accountId = a.accountId
    req.auth = a
  })
})
