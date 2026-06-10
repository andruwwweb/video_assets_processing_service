import { createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { getObjectStream } from '@mpp/storage'

export interface Scratch {
  path(name: string): string
  cleanup(): Promise<void>
}

/** Creates a per-job temp dir; `cleanup()` removes it entirely. */
export async function makeScratch(): Promise<Scratch> {
  const dir = await mkdtemp(join(tmpdir(), 'mpp-'))
  return {
    path: (name) => join(dir, name),
    cleanup: () => rm(dir, { recursive: true, force: true }),
  }
}

/** Streams an object from storage to a local file. */
export async function download(key: string, dest: string): Promise<void> {
  const stream = await getObjectStream(key)
  await pipeline(stream, createWriteStream(dest))
}
