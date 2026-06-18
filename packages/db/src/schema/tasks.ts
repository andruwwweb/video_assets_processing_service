import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { stepStatus, taskStatus } from './enums'
import { videos } from './videos'

/** User-facing processing task (spec §6); one task ↔ one BullMQ flow. */
export const processingTasks = pgTable(
  'processing_tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    status: taskStatus('status').notNull().default('queued'),
    // Aggregated 0..100 progress across task_steps.
    progress: integer('progress').notNull().default(0),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('processing_tasks_video_id_idx').on(t.videoId)],
)

/** Per-step status (probe, thumbnail, rendition_720, hls, ...). */
export const taskSteps = pgTable(
  'task_steps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => processingTasks.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    status: stepStatus('status').notNull().default('pending'),
    progress: integer('progress').notNull().default(0),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('task_steps_task_id_idx').on(t.taskId)],
)
