/**
 * Job payloads. Phase A is the `probe` gate; phase B is a dynamic fan-out flow
 * (finalize ⟵ { thumbnail, frames, clip, audio, hls ⟵ rendition_* }) built by
 * the worker after probe knows the source resolution.
 */

import type { WebhookEvent } from '@mpp/core'

interface BaseJobData {
  videoId: string
  taskId: string
  accountId: string
}

export type ProbeJobData = BaseJobData
export type FinalizeJobData = BaseJobData
export type AudioJobData = BaseJobData & { sourceKey: string }

export interface ThumbnailJobData extends BaseJobData {
  sourceKey: string
  /** Timestamp (seconds) for the poster frame. */
  atSec: number
}

export interface FramesJobData extends BaseJobData {
  sourceKey: string
  /** One frame every `intervalSec` seconds. */
  intervalSec: number
}

export interface ClipJobData extends BaseJobData {
  sourceKey: string
  startSec: number
  durationSec: number
  height: number
}

export interface RenditionJobData extends BaseJobData {
  sourceKey: string
  /** Rendition label, e.g. "720p". */
  label: string
  height: number
  /** Source duration (seconds) from probe; used for live progress %. */
  durationSec?: number
}

export interface HlsJobData extends BaseJobData {
  /** Rendition labels to package, e.g. ["360p","720p"]. */
  labels: string[]
}

/** Job names dispatched within the queues. */
export const JOB = {
  probe: 'probe',
  thumbnail: 'thumbnail',
  frames: 'frames',
  clip: 'clip',
  audio: 'audio',
  rendition: 'rendition',
  hls: 'hls',
  finalize: 'finalize',
} as const

// --- Webhooks (stage 5) ---

/** Domain event emitted by the worker; the dispatcher fans it out to endpoints. */
export interface WebhookEventJobData {
  accountId: string
  event: WebhookEvent
  payload: Record<string, unknown>
}

/** One delivery target (per endpoint), with its own retry policy. */
export interface WebhookDeliveryJobData {
  deliveryId: string
  endpointId: string
  url: string
  secret: string
  event: WebhookEvent
  payload: Record<string, unknown>
}

export const WEBHOOK_JOB = {
  event: 'webhook-event',
  delivery: 'webhook-delivery',
} as const
