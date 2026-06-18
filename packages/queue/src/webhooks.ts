import { DEFAULT_JOB_OPTIONS, makeQueue, QUEUE, type Queue } from './queues'
import { WEBHOOK_JOB, type WebhookEventJobData } from './contracts'

let cached: Queue | null = null
function webhooksQueue(): Queue {
  if (!cached) cached = makeQueue(QUEUE.webhooks)
  return cached
}

/** Enqueues a domain event for the webhook dispatcher to fan out (durable). */
export async function enqueueWebhookEvent(data: WebhookEventJobData): Promise<void> {
  await webhooksQueue().add(WEBHOOK_JOB.event, data, DEFAULT_JOB_OPTIONS)
}
