import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

// --- Passwords (node scrypt; no native deps) ---

/** Hashes a password as `salt:derivedKey` (both hex). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const dk = await scryptAsync(password, salt, 64)
  return `${salt.toString('hex')}:${dk.toString('hex')}`
}

/** Constant-time verify against a `salt:derivedKey` hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const dk = await scryptAsync(password, Buffer.from(saltHex, 'hex'), 64)
  const expected = Buffer.from(hashHex, 'hex')
  return dk.length === expected.length && timingSafeEqual(dk, expected)
}

// --- API keys (only the SHA-256 hash is stored) ---

export const API_KEY_PREFIX = 'mpp_live_'

export function isApiKey(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX)
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/** Generates a new key; `prefix` is shown to the user, `hash` is stored. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = API_KEY_PREFIX + randomBytes(24).toString('base64url')
  return { key, prefix: key.slice(0, API_KEY_PREFIX.length + 6), hash: hashApiKey(key) }
}
