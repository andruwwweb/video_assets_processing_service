import { eq } from 'drizzle-orm'
import { processingTasks, type Database } from '@mpp/db'

const ACTIVE_TASK_STATUSES = new Set(['queued', 'processing'])

/**
 * Cooperative cancel/delete gate. Returns false when the task was cancelled,
 * already finished, or its row is gone (video deleted) — the processor should
 * then bail without doing work or writing artifacts/statuses (idempotent no-op).
 * Checked at the start of every processor; the in-flight FFmpeg step still
 * finishes (no hard kill), later steps of the fan-out never start.
 */
export async function isTaskActive(db: Database, taskId: string): Promise<boolean> {
  const [t] = await db
    .select({ status: processingTasks.status })
    .from(processingTasks)
    .where(eq(processingTasks.id, taskId))
    .limit(1)
  return !!t && ACTIVE_TASK_STATUSES.has(t.status)
}
