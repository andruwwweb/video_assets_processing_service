import { FlowProducer, Queue, Worker, type Processor } from 'bullmq'
import { getQueueConnection } from './connection'

export type { Queue, Worker, FlowProducer, Job, Processor } from 'bullmq'

/** Queue names by load class (architecture §5). */
export const QUEUE = {
  probe: 'probe',
  mediaLight: 'media-light', // thumbnail, frames, clip, audio
  mediaHeavy: 'media-heavy', // transcode renditions, hls
  webhooks: 'webhooks', // outbound event delivery (stage 5)
} as const
export type QueueName = (typeof QUEUE)[keyof typeof QUEUE]

/** Retry/retention defaults for all jobs (architecture §5). */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 86400 }, // keep completed for 24h
  removeOnFail: false, // keep failed for inspection
}

export function makeQueue(name: QueueName): Queue {
  return new Queue(name, {
    connection: getQueueConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  })
}

/** Build a worker for a queue. Workers run in the media container. */
export function makeWorker<T = unknown>(
  name: QueueName,
  processor: Processor<T>,
  opts?: { concurrency?: number },
): Worker<T> {
  // Only set concurrency when given; BullMQ rejects an explicit `undefined`.
  return new Worker<T>(name, processor, {
    connection: getQueueConnection(),
    ...(opts?.concurrency ? { concurrency: opts.concurrency } : {}),
  })
}

export function makeFlowProducer(): FlowProducer {
  return new FlowProducer({ connection: getQueueConnection() })
}
