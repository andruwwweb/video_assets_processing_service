import { loadDotenv } from '@mpp/config'
import { defineConfig } from 'drizzle-kit'

// Load .env and take the connection string only from it — no fallback in code.
loadDotenv()
const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL is not set — create .env (cp .env.example .env)')
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
})
