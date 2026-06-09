import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { accounts } from './accounts'
import { apiKeyStatus } from './enums'

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Префикс показывается пользователю для идентификации ключа (например, mpp_live_AbCd).
    prefix: text('prefix').notNull(),
    // Хранится только хэш ключа, никогда сам ключ.
    keyHash: text('key_hash').notNull().unique(),
    status: apiKeyStatus('status').notNull().default('active'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('api_keys_account_id_idx').on(t.accountId)],
)

export const apiKeyUsage = pgTable(
  'api_key_usage',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    apiKeyId: uuid('api_key_id')
      .notNull()
      .references(() => apiKeys.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    statusCode: integer('status_code').notNull(),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('api_key_usage_api_key_id_idx').on(t.apiKeyId)],
)
