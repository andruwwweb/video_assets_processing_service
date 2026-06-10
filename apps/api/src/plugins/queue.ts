import fp from 'fastify-plugin'
import { makeQueue, QUEUE, type Queue } from '@mpp/queue'

declare module 'fastify' {
  interface FastifyInstance {
    probeQueue: Queue
  }
}

/** Provides the probe-queue producer. The phase-B flow is built by the worker (stage 2b). */
export const queuePlugin = fp(async (app) => {
  const probeQueue = makeQueue(QUEUE.probe)
  app.decorate('probeQueue', probeQueue)
  app.addHook('onClose', async () => {
    await probeQueue.close()
  })
})
