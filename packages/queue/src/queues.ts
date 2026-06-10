import { FlowProducer, Queue, Worker, type Processor } from 'bullmq'
import { getQueueConnection } from './connection'

export type { Queue, Worker, FlowProducer, Job, Processor } from 'bullmq'

/** Queue names by load class (architecture §5). MVP starts with probe + media-heavy. */
export const QUEUE = {
  probe: 'probe',
  mediaHeavy: 'media-heavy',
} as const
export type QueueName = (typeof QUEUE)[keyof typeof QUEUE]

export function makeQueue(name: QueueName): Queue {
  return new Queue(name, { connection: getQueueConnection() })
}

/** Build a worker for a queue. Workers run on stage 2b (the media container). */
export function makeWorker<T = unknown>(name: QueueName, processor: Processor<T>): Worker<T> {
  return new Worker<T>(name, processor, { connection: getQueueConnection() })
}

export function makeFlowProducer(): FlowProducer {
  return new FlowProducer({ connection: getQueueConnection() })
}
