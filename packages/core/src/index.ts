/**
 * Single source of truth for domain enums.
 * These tuples are used both as TS types and as pgEnum values in @mpp/db.
 */

export const VIDEO_STATUSES = [
  'awaiting_upload',
  'uploaded',
  'processing',
  'ready',
  'failed',
  'expired',
  'deleted',
] as const
export type VideoStatus = (typeof VIDEO_STATUSES)[number]

export const TASK_STATUSES = ['queued', 'processing', 'ready', 'failed'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const STEP_STATUSES = ['pending', 'processing', 'done', 'failed'] as const
export type StepStatus = (typeof STEP_STATUSES)[number]

/** Processing artifact types (architecture §8). */
export const ARTIFACT_TYPES = [
  'thumbnail',
  'frames',
  'clip',
  'rendition',
  'hls',
  'audio',
] as const
export type ArtifactType = (typeof ARTIFACT_TYPES)[number]

export const API_KEY_STATUSES = ['active', 'disabled'] as const
export type ApiKeyStatus = (typeof API_KEY_STATUSES)[number]

/** Webhook events (spec §9). */
export const WEBHOOK_EVENTS = [
  'processing.completed',
  'processing.failed',
  'artifact.created',
] as const
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

export const DELIVERY_STATUSES = ['pending', 'delivered', 'failed', 'dead'] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

/** Metadata extracted from the source via ffprobe (architecture §5.2, §8). */
export interface VideoMetadata {
  duration?: number
  width?: number
  height?: number
  fps?: number
  videoCodec?: string
  audioCodec?: string
  bitrate?: number
  aspectRatio?: string
  size?: number
}

/**
 * Real-time events published by the worker over Redis Pub/Sub and pushed to
 * clients by the WS gateway (architecture §6, spec §7). The same union is reused
 * by webhooks on stage 5.
 */
export const TASK_EVENT_TYPES = [
  'task.started',
  'task.progress',
  'task.completed',
  'task.failed',
  'artifact.created',
] as const
export type TaskEventType = (typeof TASK_EVENT_TYPES)[number]

interface TaskEventBase {
  taskId: string
  videoId: string
  accountId: string
  /** ISO-8601 emit time. */
  at: string
}

export type TaskEvent =
  | (TaskEventBase & { type: 'task.started' })
  | (TaskEventBase & {
      type: 'task.progress'
      /** Aggregated task progress 0..100. */
      progress: number
      /** Step that produced this tick, e.g. "rendition_720". */
      step: string
      /** That step's own progress 0..100. */
      stepProgress: number
    })
  | (TaskEventBase & { type: 'task.completed' })
  | (TaskEventBase & { type: 'task.failed'; error: string })
  | (TaskEventBase & { type: 'artifact.created'; artifactType: ArtifactType; storageKey: string })

/**
 * Per-step weights for task-progress aggregation (architecture §6). Weights are
 * proportional to expected cost; probe is a fast gate, transcode is the bulk.
 * Extended with fan-out steps (thumbnail/clip/audio/hls) on stage 4.
 */
export const STEP_WEIGHTS: Record<string, number> = {
  probe: 5,
  thumbnail: 2,
  frames: 4,
  clip: 8,
  audio: 5,
  rendition_360: 8,
  rendition_480: 11,
  rendition_720: 16,
  rendition_1080: 24,
  hls: 12,
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

/**
 * Weighted task progress (0..100) from per-step progress. Pass the full planned
 * set of steps with their current progress; unknown step types default to weight 1.
 */
export function aggregateTaskProgress(steps: { type: string; progress: number }[]): number {
  let weighted = 0
  let total = 0
  for (const s of steps) {
    const w = STEP_WEIGHTS[s.type] ?? 1
    weighted += w * clampPct(s.progress)
    total += w
  }
  return total === 0 ? 0 : Math.round(weighted / total)
}
