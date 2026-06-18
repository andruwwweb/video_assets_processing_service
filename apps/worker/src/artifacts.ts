import type { ArtifactType } from '@mpp/core'
import { artifacts, type Database } from '@mpp/db'
import { publishTaskEvent } from '@mpp/queue'

export interface RecordArtifactInput {
  videoId: string
  taskId: string
  accountId: string
  type: ArtifactType
  storageKey: string
  mime: string
  size: number
  attributes?: Record<string, unknown>
}

/** Inserts an artifact row (idempotent via unique storage_key) + emits artifact.created. */
export async function recordArtifact(db: Database, a: RecordArtifactInput): Promise<void> {
  await db
    .insert(artifacts)
    .values({
      videoId: a.videoId,
      type: a.type,
      storageKey: a.storageKey,
      mime: a.mime,
      size: a.size,
      attributes: a.attributes ?? {},
      status: 'done',
    })
    .onConflictDoNothing({ target: artifacts.storageKey })
  await publishTaskEvent({
    type: 'artifact.created',
    taskId: a.taskId,
    videoId: a.videoId,
    accountId: a.accountId,
    artifactType: a.type,
    storageKey: a.storageKey,
    at: new Date().toISOString(),
  })
}
