import type { FastifyInstance, FastifyReply } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { loadEnv } from '@mpp/config'
import { accounts, users } from '@mpp/db'
import { hashPassword, verifyPassword } from '../lib/auth'
import { ErrorResponse } from '../schemas/common'

const Credentials = z.object({ email: z.string().email(), password: z.string().min(8) })
const RegisterBody = Credentials.extend({ accountName: z.string().min(1).optional() })
const AuthResponse = z.object({
  token: z.string(),
  user: z.object({ id: z.string().uuid(), email: z.string(), accountId: z.string().uuid() }),
})
const MeResponse = z.object({
  userId: z.string().uuid(),
  accountId: z.string().uuid(),
  email: z.string(),
})

function err(code: string, message: string) {
  return { error: { code, message, details: null } }
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>()
  const env = loadEnv()

  function setAuthCookie(reply: FastifyReply, token: string): void {
    reply.setCookie('token', token, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: env.JWT_TTL_SECONDS,
    })
  }

  // Register → creates an account + first user, auto-logs in.
  r.post(
    '/auth/register',
    { schema: { body: RegisterBody, response: { 201: AuthResponse, 409: ErrorResponse } } },
    async (req, reply) => {
      const { email, password, accountName } = req.body
      const [existing] = await app.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
      if (existing) return reply.code(409).send(err('EMAIL_TAKEN', 'email already registered'))

      const passwordHash = await hashPassword(password)
      const { userId, accountId } = await app.db.transaction(async (tx) => {
        const [acc] = await tx
          .insert(accounts)
          .values({ name: accountName ?? email })
          .returning({ id: accounts.id })
        const [u] = await tx
          .insert(users)
          .values({ accountId: acc.id, email, passwordHash })
          .returning({ id: users.id })
        return { userId: u.id, accountId: acc.id }
      })

      const token = app.jwt.sign({ accountId, userId }, { expiresIn: env.JWT_TTL_SECONDS })
      setAuthCookie(reply, token)
      reply.code(201)
      return { token, user: { id: userId, email, accountId } }
    },
  )

  // Login → JWT in httpOnly cookie (+ returned for API clients).
  r.post(
    '/auth/login',
    { schema: { body: Credentials, response: { 200: AuthResponse, 401: ErrorResponse } } },
    async (req, reply) => {
      const { email, password } = req.body
      const [u] = await app.db.select().from(users).where(eq(users.email, email)).limit(1)
      if (!u || !(await verifyPassword(password, u.passwordHash))) {
        return reply.code(401).send(err('INVALID_CREDENTIALS', 'invalid email or password'))
      }
      const token = app.jwt.sign({ accountId: u.accountId, userId: u.id }, { expiresIn: env.JWT_TTL_SECONDS })
      setAuthCookie(reply, token)
      return { token, user: { id: u.id, email: u.email, accountId: u.accountId } }
    },
  )

  r.get(
    '/auth/me',
    { onRequest: app.requireUser, schema: { response: { 200: MeResponse, 401: ErrorResponse } } },
    async (req) => {
      const [u] = await app.db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, req.auth!.userId!))
        .limit(1)
      return { userId: req.auth!.userId!, accountId: req.accountId, email: u?.email ?? '' }
    },
  )

  r.post('/auth/logout', { onRequest: app.requireUser }, async (_req, reply) => {
    reply.clearCookie('token', { path: '/' })
    return { ok: true }
  })
}
