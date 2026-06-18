import { Redis } from 'ioredis'
import { loadEnv } from '@mpp/config'
import type { TaskEvent } from '@mpp/core'
import { getQueueConnection } from './connection'

/**
 * Real-time event bus over Redis Pub/Sub (architecture §6). A single global
 * channel: every WS instance subscribes once and fans out to its local
 * subscribers by taskId — no dynamic SUBSCRIBE/UNSUBSCRIBE per task.
 */
export const TASK_EVENTS_CHANNEL = 'mpp:task-events'

/** Publishes a task event. Best-effort: Postgres stays the source of truth. */
export async function publishTaskEvent(event: TaskEvent): Promise<void> {
  await getQueueConnection().publish(TASK_EVENTS_CHANNEL, JSON.stringify(event))
}

export interface TaskEventSubscription {
  close(): Promise<void>
}

/**
 * Subscribes to task events on a dedicated connection (a connection in subscribe
 * mode cannot issue normal commands). Malformed payloads are ignored.
 */
export function createTaskEventSubscriber(
  onEvent: (event: TaskEvent) => void,
): TaskEventSubscription {
  const env = loadEnv()
  const sub = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
  // (Re)subscribe on every successful connect: a subscriber that started while
  // Redis was unreachable — or dropped and reconnected — reliably re-subscribes.
  sub.on('ready', () => {
    sub.subscribe(TASK_EVENTS_CHANNEL).catch(() => {})
  })
  // Connection errors are transient (ioredis retries); swallow to avoid crashing.
  sub.on('error', () => {})
  sub.on('message', (_channel, payload) => {
    try {
      onEvent(JSON.parse(payload) as TaskEvent)
    } catch {
      // ignore malformed events
    }
  })
  return {
    close: async () => {
      await sub.quit()
    },
  }
}
