import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'

/**
 * Walks up from cwd to the monorepo root (where pnpm-workspace.yaml lives)
 * to load the shared .env regardless of which package started the process.
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
/** Loads the root .env into process.env (once). Does not validate. */
export function loadDotenv(): void {
  if (envFileLoaded) return
  const root = findRepoRoot(process.cwd())
  dotenv.config({ path: join(root, '.env') })
  envFileLoaded = true
}

/** "true"/"1"/"yes" -> true, otherwise false. */
const boolFromEnv = z
  .string()
  .transform((v) => ['1', 'true', 'yes'].includes(v.toLowerCase()))

/**
 * No defaults: everything comes from .env (see .env.example).
 * A missing variable is a startup error.
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

  API_DOCS_ENABLED: boolFromEnv,
  DEV_ACCOUNT_ID: z.string().uuid(),
  PRESIGN_PUT_TTL_SECONDS: z.coerce.number().int().positive(),
  PRESIGN_GET_TTL_SECONDS: z.coerce.number().int().positive(),

  PROBE_TIMEOUT_MS: z.coerce.number().int().positive(),
  TRANSCODE_TIMEOUT_MS: z.coerce.number().int().positive(),
  MEDIA_LIGHT_TIMEOUT_MS: z.coerce.number().int().positive(),

  // Auth / rate limit / webhooks (stage 5).
  JWT_SECRET: z.string().min(16),
  JWT_TTL_SECONDS: z.coerce.number().int().positive(),
  RATE_LIMIT_MAX: z.coerce.number().int().positive(),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive(),
  API_KEY_CACHE_TTL_SECONDS: z.coerce.number().int().positive(),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive(),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().positive(),
})

export type Env = z.infer<typeof EnvSchema>

let cached: Env | null = null

/** Loads (once) and validates environment variables. Throws on invalid config. */
export function loadEnv(): Env {
  if (cached) return cached
  loadDotenv()
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error(
      'Invalid or incomplete .env configuration (create it: cp .env.example .env):\n',
      JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
    )
    throw new Error('Invalid environment variables')
  }
  cached = parsed.data
  return cached
}
