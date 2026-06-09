import { loadDotenv } from '@mpp/config'
import { defineConfig } from 'drizzle-kit'

// Грузим .env и берём строку подключения только из него — без фолбэка в коде.
loadDotenv()
const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL не задан — создай .env (cp .env.example .env)')
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
})
