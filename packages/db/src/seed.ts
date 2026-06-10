import { loadEnv } from '@mpp/config'
import { accounts } from './schema'
import { createDb } from './client'

/** Idempotently inserts the fixed dev account the API uses on stage 2a (no auth yet). */
async function seed(): Promise<void> {
  const env = loadEnv()
  const { db, pool } = createDb(env.DATABASE_URL)
  try {
    await db
      .insert(accounts)
      .values({ id: env.DEV_ACCOUNT_ID, name: 'Dev Account' })
      .onConflictDoNothing({ target: accounts.id })
    console.log(`seeded dev account ${env.DEV_ACCOUNT_ID}`)
  } finally {
    await pool.end()
  }
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
