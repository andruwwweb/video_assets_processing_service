import { extname } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { and, desc, eq } from 'drizzle-orm'
import { artifacts, processingTasks, taskSteps, videos } from '@mpp/db'
import { objectExists, originalKey, presignGet, presignPut } from '@mpp/storage'
import type { ProbeJobData } from '@mpp/queue'
import {
  ArtifactList,
  CompleteResponse,
  CreateVideoBody,
  CreateVideoResponse,
  ListVideosQuery,
  VideoDetail,
  VideoList,
} from '../schemas/videos'
import { ErrorResponse, IdParam } from '../schemas/common'

function extOf(filename: string): string {
  return extname(filename).slice(1).toLowerCase() || 'bin'
}

function err(code: string, message: string) {
  return { error: { code, message, details: null } }
}

export async function videoRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>()

  // Create a video record and return a presigned PUT URL for direct upload.
  r.post(
    '/videos',
    { schema: { body: CreateVideoBody, response: { 201: CreateVideoResponse } } },
    async (req, reply) => {
      const [row] = await app.db
        .insert(videos)
        .values({ accountId: req.accountId, originalFilename: req.body.filename })
        .returning({ id: videos.id })
      const key = originalKey(req.accountId, row.id, extOf(req.body.filename))
      const uploadUrl = await presignPut(key)
      reply.code(201)
      return { videoId: row.id, uploadUrl }
    },
  )

  // Confirm the upload, create the task, enqueue the probe job.
  r.post(
    '/videos/:id/complete',
    {
      schema: {
        params: IdParam,
        response: { 202: CompleteResponse, 404: ErrorResponse, 409: ErrorResponse },
      },
    },
    async (req, reply) => {
      const [video] = await app.db
        .select()
        .from(videos)
        .where(and(eq(videos.id, req.params.id), eq(videos.accountId, req.accountId)))
        .limit(1)
      if (!video) return reply.code(404).send(err('NOT_FOUND', 'video not found'))
      if (video.status !== 'awaiting_upload') {
        return reply.code(409).send(err('INVALID_STATE', `video is ${video.status}`))
      }

      const key = originalKey(req.accountId, video.id, extOf(video.originalFilename))
      if (!(await objectExists(key))) {
        return reply.code(409).send(err('NOT_UPLOADED', 'file has not been uploaded yet'))
      }

      const taskId = await app.db.transaction(async (tx) => {
        await tx
          .update(videos)
          .set({ status: 'uploaded', storageKey: key })
          .where(eq(videos.id, video.id))
        const [task] = await tx
          .insert(processingTasks)
          .values({ videoId: video.id })
          .returning({ id: processingTasks.id })
        await tx.insert(taskSteps).values({ taskId: task.id, type: 'probe' })
        return task.id
      })

      const job: ProbeJobData = { videoId: video.id, taskId, accountId: req.accountId }
      await app.probeQueue.add('probe', job)

      reply.code(202)
      return { taskId }
    },
  )

  // List videos of the account.
  r.get(
    '/videos',
    { schema: { querystring: ListVideosQuery, response: { 200: VideoList } } },
    async (req) => {
      const rows = await app.db
        .select()
        .from(videos)
        .where(eq(videos.accountId, req.accountId))
        .orderBy(desc(videos.createdAt))
        .limit(req.query.limit)
      return {
        items: rows.map((v) => ({
          id: v.id,
          originalFilename: v.originalFilename,
          status: v.status,
          createdAt: v.createdAt.toISOString(),
        })),
      }
    },
  )

  // Video detail + metadata.
  r.get(
    '/videos/:id',
    { schema: { params: IdParam, response: { 200: VideoDetail, 404: ErrorResponse } } },
    async (req, reply) => {
      const [v] = await app.db
        .select()
        .from(videos)
        .where(and(eq(videos.id, req.params.id), eq(videos.accountId, req.accountId)))
        .limit(1)
      if (!v) return reply.code(404).send(err('NOT_FOUND', 'video not found'))
      return {
        id: v.id,
        originalFilename: v.originalFilename,
        status: v.status,
        createdAt: v.createdAt.toISOString(),
        metadata: v.metadata ?? null,
      }
    },
  )

  // Artifacts of a video with presigned download URLs (empty until stage 2b).
  r.get(
    '/videos/:id/artifacts',
    { schema: { params: IdParam, response: { 200: ArtifactList, 404: ErrorResponse } } },
    async (req, reply) => {
      const [v] = await app.db
        .select({ id: videos.id })
        .from(videos)
        .where(and(eq(videos.id, req.params.id), eq(videos.accountId, req.accountId)))
        .limit(1)
      if (!v) return reply.code(404).send(err('NOT_FOUND', 'video not found'))

      const rows = await app.db.select().from(artifacts).where(eq(artifacts.videoId, v.id))
      const items = await Promise.all(
        rows.map(async (a) => ({
          id: a.id,
          type: a.type,
          mime: a.mime,
          size: a.size,
          downloadUrl: await presignGet(a.storageKey),
        })),
      )
      return { items }
    },
  )
}
