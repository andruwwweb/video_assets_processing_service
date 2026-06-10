import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { accounts } from './accounts'
import { deliveryStatus, webhookEvent } from './enums'

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    // Secret for HMAC-signing delivered events.
    secret: text('secret').notNull(),
    events: webhookEvent('events').array().notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('webhook_endpoints_account_id_idx').on(t.accountId)],
)

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
    eventType: webhookEvent('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    attempt: integer('attempt').notNull().default(0),
    status: deliveryStatus('status').notNull().default('pending'),
    responseCode: integer('response_code'),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('webhook_deliveries_endpoint_id_idx').on(t.endpointId)],
)
