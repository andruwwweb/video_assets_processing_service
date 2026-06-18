import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { processingTasks, taskSteps, videos } from '@mpp/db'

// Server-side keepalive so corporate proxies don't drop idle connections.
const PING_INTERVAL_MS = 30000

/**
 * Real-time task feed (architecture §6). Sends an initial `snapshot` from
 * Postgres (the source of truth), then streams live `TaskEvent`s. Scoped by
 * account; token auth arrives with API keys on stage 5.
 */
export async function wsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/tasks/:id/ws', { websocket: true }, async (socket, req) => {
    const taskId = (req.params as { id: string }).id
    const accountId = req.accountId

    const [task] = await app.db
      .select({
        id: processingTasks.id,
        videoId: processingTasks.videoId,
        status: processingTasks.status,
        progress: processingTasks.progress,
      })
      .from(processingTasks)
      .innerJoin(videos, eq(videos.id, processingTasks.videoId))
      .where(and(eq(processingTasks.id, taskId), eq(videos.accountId, accountId)))
      .limit(1)

    if (!task) {
      socket.send(JSON.stringify({ type: 'error', code: 'NOT_FOUND', message: 'task not found' }))
      socket.close()
      return
    }

    // Register first so no event between snapshot and subscribe is lost.
    app.wsHub.add(task.id, socket)

    const steps = await app.db
      .select({ type: taskSteps.type, status: taskSteps.status, progress: taskSteps.progress })
      .from(taskSteps)
      .where(eq(taskSteps.taskId, task.id))
    socket.send(
      JSON.stringify({
        type: 'snapshot',
        taskId: task.id,
        videoId: task.videoId,
        status: task.status,
        progress: task.progress,
        steps,
        at: new Date().toISOString(),
      }),
    )

    const ping = setInterval(() => {
      if (socket.readyState === socket.OPEN) socket.ping()
    }, PING_INTERVAL_MS)
    socket.on('close', () => {
      clearInterval(ping)
      app.wsHub.remove(task.id, socket)
    })
  })
}
