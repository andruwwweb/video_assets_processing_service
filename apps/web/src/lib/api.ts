import type {
  ApiKey,
  Artifact,
  AuthResponse,
  CreateKeyResponse,
  CreateVideoResponse,
  CreateWebhookResponse,
  Delivery,
  Me,
  TaskDetail,
  VideoDetail,
  VideoItem,
  Webhook,
} from './types'

/** Error from the API's `{ error: { code, message, details } }` envelope. */
export class ApiException extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown = null,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Only declare a JSON content-type when there's a body — otherwise Fastify
  // rejects the empty body (FST_ERR_CTP_EMPTY_JSON_BODY) on bodyless POST/DELETE.
  const headers: Record<string, string> = { ...((init?.headers as Record<string, string>) ?? {}) }
  if (init?.body != null) headers['content-type'] = 'application/json'
  const res = await fetch(path, {
    ...init,
    credentials: 'include', // send the JWT cookie
    headers,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : undefined
  if (!res.ok) {
    const e = data?.error ?? { code: 'ERROR', message: res.statusText, details: null }
    throw new ApiException(res.status, e.code, e.message, e.details)
  }
  return data as T
}

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const api = {
  // auth
  register: (b: { email: string; password: string; accountName?: string }) =>
    request<AuthResponse>('/v1/auth/register', json(b)),
  login: (b: { email: string; password: string }) => request<AuthResponse>('/v1/auth/login', json(b)),
  me: () => request<Me>('/v1/auth/me'),
  logout: () => request<{ ok: boolean }>('/v1/auth/logout', { method: 'POST' }),

  // videos
  listVideos: () => request<{ items: VideoItem[] }>('/v1/videos'),
  createVideo: (b: { filename: string }) => request<CreateVideoResponse>('/v1/videos', json(b)),
  getVideo: (id: string) => request<VideoDetail>(`/v1/videos/${id}`),
  completeVideo: (id: string) => request<{ taskId: string }>(`/v1/videos/${id}/complete`, { method: 'POST' }),
  cancelVideo: (id: string) =>
    request<{ taskId: string; status: string }>(`/v1/videos/${id}/cancel`, { method: 'POST' }),
  deleteVideo: (id: string) => request<{ ok: boolean }>(`/v1/videos/${id}`, { method: 'DELETE' }),
  artifacts: (id: string) => request<{ items: Artifact[] }>(`/v1/videos/${id}/artifacts`),
  getTask: (id: string) => request<TaskDetail>(`/v1/tasks/${id}`),

  // api keys
  listKeys: () => request<{ items: ApiKey[] }>('/v1/keys'),
  createKey: (b: { name: string }) => request<CreateKeyResponse>('/v1/keys', json(b)),
  disableKey: (id: string) => request<ApiKey>(`/v1/keys/${id}/disable`, { method: 'POST' }),
  deleteKey: (id: string) => request<{ ok: boolean }>(`/v1/keys/${id}`, { method: 'DELETE' }),

  // webhooks
  listWebhooks: () => request<{ items: Webhook[] }>('/v1/webhooks'),
  createWebhook: (b: { url: string; events: string[] }) =>
    request<CreateWebhookResponse>('/v1/webhooks', json(b)),
  deleteWebhook: (id: string) => request<{ ok: boolean }>(`/v1/webhooks/${id}`, { method: 'DELETE' }),
  deliveries: (id: string) => request<{ items: Delivery[] }>(`/v1/webhooks/${id}/deliveries`),
}

/** Uploads a file straight to object storage via a presigned PUT URL. */
export async function uploadFile(url: string, file: File): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: { 'content-type': file.type || 'application/octet-stream' },
  })
  if (!res.ok) throw new Error(`upload failed: ${res.status}`)
}
