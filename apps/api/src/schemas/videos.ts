import { z } from 'zod'

export const CreateVideoBody = z.object({
  filename: z.string().min(1),
})

export const CreateVideoResponse = z.object({
  videoId: z.string().uuid(),
  uploadUrl: z.string().url(),
})

export const CompleteResponse = z.object({
  taskId: z.string().uuid(),
})

export const VideoMetadata = z
  .object({
    duration: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    fps: z.number().optional(),
    videoCodec: z.string().optional(),
    audioCodec: z.string().optional(),
    bitrate: z.number().optional(),
    aspectRatio: z.string().optional(),
    size: z.number().optional(),
  })
  .nullable()

export const VideoItem = z.object({
  id: z.string().uuid(),
  originalFilename: z.string(),
  status: z.string(),
  createdAt: z.string(),
})

export const VideoDetail = VideoItem.extend({
  metadata: VideoMetadata,
})

export const VideoList = z.object({ items: z.array(VideoItem) })

export const ListVideosQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const ArtifactItem = z.object({
  id: z.string().uuid(),
  type: z.string(),
  mime: z.string().nullable(),
  size: z.number().nullable(),
  downloadUrl: z.string().url(),
})

export const ArtifactList = z.object({ items: z.array(ArtifactItem) })
