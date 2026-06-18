import { createHmac } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { loadEnv } from '@mpp/config'
import { createDb, webhookDeliveries, webhookEndpoints } from '@mpp/db'
import {
  DEFAULT_JOB_OPTIONS,
  QUEUE,
  WEBHOOK_JOB,
  makeQueue,
  makeWorker,
  type Job,
  type WebhookDeliveryJobData,
  type WebhookEventJobData,
} from '@mpp/queue'

const env = loadEnv()
const { db, pool } = createDb(env.DATABASE_URL)
const queue = makeQueue(QUEUE.webhooks)

/** Fan out a domain event to every active subscribed endpoint of the account. */
async function handleEvent(job: Job<WebhookEventJobData>): Promise<void> {
  const { accountId, event, payload } = job.data
  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.accountId, accountId), eq(webhookEndpoints.active, true)))

  for (const ep of endpoints) {
    if (!ep.events.includes(event)) continue
    const [d] = await db
      .insert(webhookDeliveries)
      .values({ endpointId: ep.id, eventType: event, payload })
      .returning({ id: webhookDeliveries.id })
    await queue.add(
      WEBHOOK_JOB.delivery,
      {
        deliveryId: d.id,
        endpointId: ep.id,
        url: ep.url,
        secret: ep.secret,
        event,
        payload,
      } satisfies WebhookDeliveryJobData,
      { ...DEFAULT_JOB_OPTIONS, attempts: env.WEBHOOK_MAX_ATTEMPTS, jobId: `whd-${d.id}` },
    )
  }
}

/** Deliver one signed POST; throw on non-2xx so BullMQ retries with backoff. */
async function handleDelivery(job: Job<WebhookDeliveryJobData>): Promise<void> {
  const { deliveryId, url, secret, event, payload } = job.data
  const attempt = job.attemptsMade + 1
  const body = JSON.stringify({ id: deliveryId, event, data: payload, createdAt: new Date().toISOString() })
  const signature = createHmac('sha256', secret).update(body).digest('hex')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), env.WEBHOOK_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature': `sha256=${signature}`,
        'x-webhook-event': event,
        'x-webhook-id': deliveryId,
      },
      body,
      signal: controller.signal,
    })
    const ok = res.status >= 200 && res.status < 300
    await db
      .update(webhookDeliveries)
      .set({ attempt, status: ok ? 'delivered' : 'failed', responseCode: res.status })
      .where(eq(webhookDeliveries.id, deliveryId))
    if (!ok) throw new Error(`webhook ${url} returned ${res.status}`)
  } catch (err) {
    await db
      .update(webhookDeliveries)
      .set({ attempt, status: 'failed' })
      .where(eq(webhookDeliveries.id, deliveryId))
      .catch(() => {})
    throw err instanceof Error ? err : new Error(String(err))
  } finally {
    clearTimeout(timer)
  }
}

const worker = makeWorker(QUEUE.webhooks, async (job) => {
  switch (job.name) {
    case WEBHOOK_JOB.event:
      return handleEvent(job as Job<WebhookEventJobData>)
    case WEBHOOK_JOB.delivery:
      return handleDelivery(job as Job<WebhookDeliveryJobData>)
    default:
      throw new Error(`unknown webhook job: ${job.name}`)
  }
})

// On a delivery's final failure (retries exhausted), mark it dead (DLQ + history).
worker.on('failed', (job, err) => {
  console.error(`webhook job failed: ${job?.name} ${job?.id}: ${err.message}`)
  if (!job || job.name !== WEBHOOK_JOB.delivery) return
  if (job.attemptsMade < (job.opts.attempts ?? 1)) return
  const { deliveryId } = job.data as WebhookDeliveryJobData
  void db
    .update(webhookDeliveries)
    .set({ status: 'dead' })
    .where(eq(webhookDeliveries.id, deliveryId))
    .catch((e) => console.error(`failed to mark delivery dead ${deliveryId}:`, e))
})
worker.on('error', (err) => console.error(`webhook worker error: ${err.message}`))

console.log('webhook-dispatcher started')

async function shutdown(signal: string): Promise<void> {
  console.log(`shutting down (${signal})`)
  await worker.close()
  await queue.close()
  await pool.end()
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
