import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'

/**
 * Поднимается вверх по дереву от cwd до корня монорепо (где лежит pnpm-workspace.yaml),
 * чтобы загрузить общий .env независимо от того, из какого пакета запущен процесс.
 */
function findRepoRoot(start: string): string {
  let dir = start
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return start
    dir = parent
  }
}

let envFileLoaded = false
/** Загружает корневой .env в process.env (один раз). Валидацию не делает. */
export function loadDotenv(): void {
  if (envFileLoaded) return
  const root = findRepoRoot(process.cwd())
  dotenv.config({ path: join(root, '.env') })
  envFileLoaded = true
}

/** "true"/"1"/"yes" -> true, иначе false. */
const boolFromEnv = z
  .string()
  .transform((v) => ['1', 'true', 'yes'].includes(v.toLowerCase()))

/**
 * Дефолтов нет: всё берётся из .env (см. .env.example).
 * Отсутствие любой переменной — ошибка на старте.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),

  API_PORT: z.coerce.number().int().positive(),
  API_HOST: z.string().min(1),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: boolFromEnv,
})

export type Env = z.infer<typeof EnvSchema>

let cached: Env | null = null

/** Загружает (один раз) и валидирует переменные окружения. Бросает при невалидной конфигурации. */
export function loadEnv(): Env {
  if (cached) return cached
  loadDotenv()
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error(
      'Невалидная или неполная конфигурация .env (создай его: cp .env.example .env):\n',
      JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
    )
    throw new Error('Invalid environment variables')
  }
  cached = parsed.data
  return cached
}
