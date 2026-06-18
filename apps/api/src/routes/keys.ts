import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { apiKeys } from '@mpp/db'
import { generateApiKey } from '../lib/auth'
import { ErrorResponse, IdParam } from '../schemas/common'

const CreateKeyBody = z.object({ name: z.string().min(1) })
const CreateKeyResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  prefix: z.string(),
  // Shown exactly once; only the hash is stored.
  key: z.string(),
  createdAt: z.string(),
})
const KeyItem = z.object({
  id: z.string().uuid(),
  name: z.string(),
  prefix: z.string(),
  status: z.string(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
})
const KeyList = z.object({ items: z.array(KeyItem) })

function err(code: string, message: string) {
  return { error: { code, message, details: null } }
}

export async function keyRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>()

  r.post(
    '/keys',
    { schema: { body: CreateKeyBody, response: { 201: CreateKeyResponse } } },
    async (req, reply) => {
      const { key, prefix, hash } = generateApiKey()
      const [row] = await app.db
        .insert(apiKeys)
        .values({ accountId: req.accountId, name: req.body.name, prefix, keyHash: hash })
        .returning({ id: apiKeys.id, createdAt: apiKeys.createdAt })
      reply.code(201)
      return { id: row.id, name: req.body.name, prefix, key, createdAt: row.createdAt.toISOString() }
    },
  )

  r.get('/keys', { schema: { response: { 200: KeyList } } }, async (req) => {
    const rows = await app.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.accountId, req.accountId))
      .orderBy(desc(apiKeys.createdAt))
    return {
      items: rows.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        status: k.status,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
      })),
    }
  })

  r.post(
    '/keys/:id/disable',
    { schema: { params: IdParam, response: { 200: KeyItem, 404: ErrorResponse } } },
    async (req, reply) => {
      const [k] = await app.db
        .update(apiKeys)
        .set({ status: 'disabled' })
        .where(and(eq(apiKeys.id, req.params.id), eq(apiKeys.accountId, req.accountId)))
        .returning()
      if (!k) return reply.code(404).send(err('NOT_FOUND', 'key not found'))
      await app.redis.del(`apikey:${k.keyHash}`)
      return {
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        status: k.status,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
      }
    },
  )

  r.delete(
    '/keys/:id',
    { schema: { params: IdParam, response: { 200: z.object({ ok: z.boolean() }), 404: ErrorResponse } } },
    async (req, reply) => {
      const [k] = await app.db
        .delete(apiKeys)
        .where(and(eq(apiKeys.id, req.params.id), eq(apiKeys.accountId, req.accountId)))
        .returning({ keyHash: apiKeys.keyHash })
      if (!k) return reply.code(404).send(err('NOT_FOUND', 'key not found'))
      await app.redis.del(`apikey:${k.keyHash}`)
      return { ok: true }
    },
  )
}
