/**
 * Job payloads. Phase A is the `probe` gate; the phase-B flow
 * (finalize ⟵ transcode_*) is built by the worker on stage 2b.
 */

export interface ProbeJobData {
  videoId: string
  taskId: string
  accountId: string
}

export interface TranscodeJobData {
  videoId: string
  taskId: string
  accountId: string
  sourceKey: string
  /** Rendition label, e.g. "720p". */
  label: string
  /** Source duration (seconds) from probe; used for live progress %. */
  durationSec?: number
}

export interface FinalizeJobData {
  videoId: string
  taskId: string
  accountId: string
}

/** Job names dispatched within the queues. */
export const JOB = {
  probe: 'probe',
  transcode720: 'transcode_720',
  finalize: 'finalize',
} as const
