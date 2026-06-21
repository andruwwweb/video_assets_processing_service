import { and, eq } from 'drizzle-orm'
import { processingTasks, videos, type Database } from '@mpp/db'
import { enqueueWebhookEvent, publishTaskEvent, type FinalizeJobData, type Job } from '@mpp/queue'

/** Phase B root: waits for children, then marks task + video ready. */
export async function finalizeProcessor(job: Job<FinalizeJobData>, db: Database): Promise<void> {
  const { videoId, taskId, accountId } = job.data
  // Only complete a still-processing task — guards the cancel race: if the task
  // was cancelled (or its video deleted) meanwhile, stay a no-op.
  const moved = await db.transaction(async (tx) => {
    const rows = await tx
      .update(processingTasks)
      .set({ status: 'ready', progress: 100, finishedAt: new Date() })
      .where(and(eq(processingTasks.id, taskId), eq(processingTasks.status, 'processing')))
      .returning({ id: processingTasks.id })
    if (rows.length === 0) return false
    await tx.update(videos).set({ status: 'ready' }).where(eq(videos.id, videoId))
    return true
  })
  if (!moved) return

  await publishTaskEvent({
    type: 'task.completed',
    taskId,
    videoId,
    accountId,
    at: new Date().toISOString(),
  })
  await enqueueWebhookEvent({
    accountId,
    event: 'processing.completed',
    payload: { videoId, taskId },
  })
}
