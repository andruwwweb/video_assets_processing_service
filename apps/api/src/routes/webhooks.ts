import { randomBytes } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { WEBHOOK_EVENTS } from '@mpp/core'
import { webhookDeliveries, webhookEndpoints } from '@mpp/db'
import { ErrorResponse, IdParam } from '../schemas/common'

const WebhookEventEnum = z.enum(WEBHOOK_EVENTS)
const CreateWebhookBody = z.object({
  url: z.string().url(),
  events: z.array(WebhookEventEnum).min(1),
})
const CreateWebhookResponse = z.object({
  id: z.string().uuid(),
  url: z.string(),
  events: z.array(z.string()),
  // Shown exactly once; used to verify HMAC signatures.
  secret: z.string(),
  active: z.boolean(),
  createdAt: z.string(),
})
const WebhookItem = z.object({
  id: z.string().uuid(),
  url: z.string(),
  events: z.array(z.string()),
  active: z.boolean(),
  createdAt: z.string(),
})
const WebhookList = z.object({ items: z.array(WebhookItem) })
const DeliveryItem = z.object({
  id: z.string().uuid(),
  eventType: z.string(),
  status: z.string(),
  attempt: z.number(),
  responseCode: z.number().nullable(),
  createdAt: z.string(),
})
const DeliveryList = z.object({ items: z.array(DeliveryItem) })

function err(code: string, message: string) {
  return { error: { code, message, details: null } }
}

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>()

  r.post(
    '/webhooks',
    { schema: { body: CreateWebhookBody, response: { 201: CreateWebhookResponse } } },
    async (req, reply) => {
      const secret = `whsec_${randomBytes(24).toString('base64url')}`
      const [row] = await app.db
        .insert(webhookEndpoints)
        .values({ accountId: req.accountId, url: req.body.url, secret, events: req.body.events })
        .returning()
      reply.code(201)
      return {
        id: row.id,
        url: row.url,
        events: row.events,
        secret,
        active: row.active,
        createdAt: row.createdAt.toISOString(),
      }
    },
  )

  r.get('/webhooks', { schema: { response: { 200: WebhookList } } }, async (req) => {
    const rows = await app.db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.accountId, req.accountId))
      .orderBy(desc(webhookEndpoints.createdAt))
    return {
      items: rows.map((w) => ({
        id: w.id,
        url: w.url,
        events: w.events,
        active: w.active,
        createdAt: w.createdAt.toISOString(),
      })),
    }
  })

  r.delete(
    '/webhooks/:id',
    { schema: { params: IdParam, response: { 200: z.object({ ok: z.boolean() }), 404: ErrorResponse } } },
    async (req, reply) => {
      const [w] = await app.db
        .delete(webhookEndpoints)
        .where(and(eq(webhookEndpoints.id, req.params.id), eq(webhookEndpoints.accountId, req.accountId)))
        .returning({ id: webhookEndpoints.id })
      if (!w) return reply.code(404).send(err('NOT_FOUND', 'webhook not found'))
      return { ok: true }
    },
  )

  // Delivery history for an endpoint (scoped via the endpoint's account).
  r.get(
    '/webhooks/:id/deliveries',
    { schema: { params: IdParam, response: { 200: DeliveryList, 404: ErrorResponse } } },
    async (req, reply) => {
      const [w] = await app.db
        .select({ id: webhookEndpoints.id })
        .from(webhookEndpoints)
        .where(and(eq(webhookEndpoints.id, req.params.id), eq(webhookEndpoints.accountId, req.accountId)))
        .limit(1)
      if (!w) return reply.code(404).send(err('NOT_FOUND', 'webhook not found'))
      const rows = await app.db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.endpointId, w.id))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(50)
      return {
        items: rows.map((d) => ({
          id: d.id,
          eventType: d.eventType,
          status: d.status,
          attempt: d.attempt,
          responseCode: d.responseCode ?? null,
          createdAt: d.createdAt.toISOString(),
        })),
      }
    },
  )
}
