import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { loadDotenv } from '@mpp/config'
import { createDb } from './client'

/** Applies SQL migrations from ./drizzle. Run: `pnpm db:migrate`. */
async function main(): Promise<void> {
  loadDotenv()
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set — create .env (cp .env.example .env)')

  const { db, pool } = createDb(url)
  const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))
  await migrate(db, { migrationsFolder })
  await pool.end()
  console.log('Migrations applied.')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
