import fp from 'fastify-plugin'
import fastifyWebsocket, { type WebSocket } from '@fastify/websocket'
import type { TaskEvent } from '@mpp/core'
import { createTaskEventSubscriber } from '@mpp/queue'

/** In-memory fan-out registry: taskId → live sockets on this instance. */
export interface WsHub {
  add(taskId: string, socket: WebSocket): void
  remove(taskId: string, socket: WebSocket): void
}

declare module 'fastify' {
  interface FastifyInstance {
    wsHub: WsHub
  }
}

/**
 * WS gateway core (architecture §6): registers @fastify/websocket and a single
 * Redis Pub/Sub subscriber that fans events out to this instance's sockets by
 * taskId. Stateless across instances — no sticky sessions.
 */
export const wsPlugin = fp(async (app) => {
  await app.register(fastifyWebsocket)

  const byTask = new Map<string, Set<WebSocket>>()
  app.decorate('wsHub', {
    add(taskId, socket) {
      let set = byTask.get(taskId)
      if (!set) {
        set = new Set()
        byTask.set(taskId, set)
      }
      set.add(socket)
    },
    remove(taskId, socket) {
      const set = byTask.get(taskId)
      if (!set) return
      set.delete(socket)
      if (set.size === 0) byTask.delete(taskId)
    },
  } satisfies WsHub)

  const subscriber = createTaskEventSubscriber((event: TaskEvent) => {
    const set = byTask.get(event.taskId)
    if (!set) return
    const payload = JSON.stringify(event)
    for (const socket of set) {
      if (socket.readyState === socket.OPEN) socket.send(payload)
    }
  })

  app.addHook('onClose', async () => {
    await subscriber.close()
  })
})
