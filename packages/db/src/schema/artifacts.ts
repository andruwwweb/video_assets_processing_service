import { bigint, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { artifactType, stepStatus } from './enums'
import { videos } from './videos'

export const artifacts = pgTable(
  'artifacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    type: artifactType('type').notNull(),
    storageKey: text('storage_key').notNull(),
    mime: text('mime'),
    size: bigint('size', { mode: 'number' }),
    // Специфика артефакта, например { resolution: "720p", bitrate: 2500 }.
    attributes: jsonb('attributes'),
    status: stepStatus('status').notNull().default('done'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('artifacts_video_id_idx').on(t.videoId)],
)
