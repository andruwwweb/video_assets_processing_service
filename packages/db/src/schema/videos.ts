import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { accounts } from './accounts'
import { videoStatus } from './enums'

/** Метаданные из ffprobe (architecture §5.2). */
export interface VideoMetadata {
  duration?: number
  width?: number
  height?: number
  fps?: number
  videoCodec?: string
  audioCodec?: string
  bitrate?: number
  aspectRatio?: string
  size?: number
}

export const videos = pgTable(
  'videos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    originalFilename: text('original_filename').notNull(),
    status: videoStatus('status').notNull().default('awaiting_upload'),
    // Ключ оригинала в Object Storage; null пока загрузка не подтверждена.
    storageKey: text('storage_key'),
    metadata: jsonb('metadata').$type<VideoMetadata>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('videos_account_id_idx').on(t.accountId)],
)
