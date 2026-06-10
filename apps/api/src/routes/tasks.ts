import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { processingTasks, taskSteps, videos } from '@mpp/db'
import { ErrorResponse, IdParam } from '../schemas/common'

const TaskDetail = z.object({
  id: z.string().uuid(),
  status: z.string(),
  progress: z.number(),
  steps: z.array(
    z.object({ type: z.string(), status: z.string(), progress: z.number() }),
  ),
})

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>()

  // Task status + per-step progress (WS fallback). Scoped via the task's video.
  r.get(
    '/tasks/:id',
    { schema: { params: IdParam, response: { 200: TaskDetail, 404: ErrorResponse } } },
    async (req, reply) => {
      const [task] = await app.db
        .select({
          id: processingTasks.id,
          status: processingTasks.status,
          progress: processingTasks.progress,
        })
        .from(processingTasks)
        .innerJoin(videos, eq(videos.id, processingTasks.videoId))
        .where(and(eq(processingTasks.id, req.params.id), eq(videos.accountId, req.accountId)))
        .limit(1)
      if (!task) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'task not found', details: null } })
      }

      const steps = await app.db
        .select({ type: taskSteps.type, status: taskSteps.status, progress: taskSteps.progress })
        .from(taskSteps)
        .where(eq(taskSteps.taskId, task.id))
      return { id: task.id, status: task.status, progress: task.progress, steps }
    },
  )
}
