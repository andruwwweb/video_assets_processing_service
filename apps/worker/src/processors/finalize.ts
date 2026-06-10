import { eq } from 'drizzle-orm'
import { processingTasks, videos, type Database } from '@mpp/db'
import { type FinalizeJobData, type Job } from '@mpp/queue'

/** Phase B root: waits for children, then marks task + video ready. */
export async function finalizeProcessor(job: Job<FinalizeJobData>, db: Database): Promise<void> {
  const { videoId, taskId } = job.data
  await db.transaction(async (tx) => {
    await tx
      .update(processingTasks)
      .set({ status: 'ready', progress: 100, finishedAt: new Date() })
      .where(eq(processingTasks.id, taskId))
    await tx.update(videos).set({ status: 'ready' }).where(eq(videos.id, videoId))
  })
}
