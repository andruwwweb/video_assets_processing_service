import { and, eq } from 'drizzle-orm'
import { aggregateTaskProgress } from '@mpp/core'
import { processingTasks, taskSteps, type Database } from '@mpp/db'
import { publishTaskEvent } from '@mpp/queue'

export interface ProgressInput {
  videoId: string
  taskId: string
  accountId: string
  /** Step type, e.g. "rendition_720" or "thumbnail". */
  step: string
  /** This step's progress 0..100. */
  stepProgress: number
  /** Also flip the step to `done`. */
  markDone?: boolean
}

/**
 * Persists a step's progress, recomputes the weighted task progress across all
 * steps (Stage 3 aggregator, generalized to the full fan-out), and publishes a
 * task.progress event. Best-effort over Redis; Postgres stays the source of truth.
 */
export async function reportProgress(db: Database, input: ProgressInput): Promise<void> {
  const { videoId, taskId, accountId, step, stepProgress, markDone } = input
  const taskProgress = await db.transaction(async (tx) => {
    await tx
      .update(taskSteps)
      .set(markDone ? { progress: stepProgress, status: 'done' } : { progress: stepProgress })
      .where(and(eq(taskSteps.taskId, taskId), eq(taskSteps.type, step)))
    const steps = await tx
      .select({ type: taskSteps.type, progress: taskSteps.progress })
      .from(taskSteps)
      .where(eq(taskSteps.taskId, taskId))
    const tp = aggregateTaskProgress(steps)
    await tx.update(processingTasks).set({ progress: tp }).where(eq(processingTasks.id, taskId))
    return tp
  })
  await publishTaskEvent({
    type: 'task.progress',
    taskId,
    videoId,
    accountId,
    progress: taskProgress,
    step,
    stepProgress,
    at: new Date().toISOString(),
  })
}
