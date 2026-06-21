import type { ArtifactType, VideoMetadata } from '@mpp/core'

export interface User {
  id: string
  email: string
  accountId: string
}
export interface AuthResponse {
  token: string
  user: User
}
export interface Me {
  userId: string
  accountId: string
  email: string
}

export interface VideoItem {
  id: string
  originalFilename: string
  status: string
  createdAt: string
}
export interface VideoDetail extends VideoItem {
  metadata: VideoMetadata | null
  taskId: string | null
}
export interface CreateVideoResponse {
  videoId: string
  uploadUrl: string
}
export interface Artifact {
  id: string
  type: ArtifactType
  mime: string | null
  size: number | null
  downloadUrl: string
}

export interface TaskStep {
  type: string
  status: string
  progress: number
}
export interface TaskDetail {
  id: string
  status: string
  progress: number
  steps: TaskStep[]
}

export interface ApiKey {
  id: string
  name: string
  prefix: string
  status: string
  lastUsedAt: string | null
  createdAt: string
}
export interface CreateKeyResponse {
  id: string
  name: string
  prefix: string
  key: string
  createdAt: string
}

export interface Webhook {
  id: string
  url: string
  events: string[]
  active: boolean
  createdAt: string
}
export interface CreateWebhookResponse extends Webhook {
  secret: string
}
export interface Delivery {
  id: string
  eventType: string
  status: string
  attempt: number
  responseCode: number | null
  createdAt: string
}
