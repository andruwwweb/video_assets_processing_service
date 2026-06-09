import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export type Schema = typeof schema
export type Database = NodePgDatabase<Schema>

export interface DbHandle {
  db: Database
  pool: Pool
}

/** Создаёт пул соединений и drizzle-клиент. Вызывающий обязан закрыть pool (graceful shutdown). */
export function createDb(connectionString: string): DbHandle {
  const pool = new Pool({ connectionString })
  const db = drizzle(pool, { schema })
  return { db, pool }
}
