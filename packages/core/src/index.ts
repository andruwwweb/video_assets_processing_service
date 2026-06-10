/**
 * Единый источник правды для доменных перечислений.
 * Эти кортежи используются и в TS-типах, и как значения pgEnum в @mpp/db.
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

/** Типы артефактов обработки (architecture §8). */
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

/** События webhooks (ТЗ §9). */
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
