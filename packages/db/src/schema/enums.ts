import { pgEnum } from 'drizzle-orm/pg-core'
import {
  API_KEY_STATUSES,
  ARTIFACT_TYPES,
  DELIVERY_STATUSES,
  STEP_STATUSES,
  TASK_STATUSES,
  VIDEO_STATUSES,
  WEBHOOK_EVENTS,
} from '@mpp/core'

export const videoStatus = pgEnum('video_status', VIDEO_STATUSES)
export const taskStatus = pgEnum('task_status', TASK_STATUSES)
export const stepStatus = pgEnum('step_status', STEP_STATUSES)
export const artifactType = pgEnum('artifact_type', ARTIFACT_TYPES)
export const apiKeyStatus = pgEnum('api_key_status', API_KEY_STATUSES)
export const webhookEvent = pgEnum('webhook_event', WEBHOOK_EVENTS)
export const deliveryStatus = pgEnum('delivery_status', DELIVERY_STATUSES)
