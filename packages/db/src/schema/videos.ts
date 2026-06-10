import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { VideoMetadata } from '@mpp/core'
import { accounts } from './accounts'
import { videoStatus } from './enums'

export type { VideoMetadata } from '@mpp/core'

export const videos = pgTable(
  'videos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    originalFilename: text('original_filename').notNull(),
    status: videoStatus('status').notNull().default('awaiting_upload'),
    // Original object storage key; null until the upload is confirmed.
    storageKey: text('storage_key'),
    metadata: jsonb('metadata').$type<VideoMetadata>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('videos_account_id_idx').on(t.accountId)],
)
