'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Column } from 'primereact/column'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { DataTable } from 'primereact/datatable'
import { ProgressBar } from 'primereact/progressbar'
import { Tag } from 'primereact/tag'
import { Toast } from 'primereact/toast'
import { api } from '@/lib/api'
import { statusSeverity } from '@/lib/status'
import type { Artifact, TaskDetail, TaskStep } from '@/lib/types'
import { useTaskWs } from '@/lib/ws'

function formatBytes(n: number | null): string {
  if (!n) return '—'
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`
}

// On-brand chip colors for a pipeline step, by status.
function stepChip(status: TaskStep['status']): string {
  switch (status) {
    case 'completed':
      return 'text-brand bg-brand-soft border-transparent'
    case 'running':
      return 'text-primary-contrast bg-primary border-transparent'
    case 'failed':
      return 'text-red-600 border-red-300'
    default:
      return 'text-surface-500 border-surface-border'
  }
}

export default function VideoDetailPage({ params }: { params: { id: string } }) {
  const id = params.id
  const router = useRouter()
  const qc = useQueryClient()
  const toast = useRef<Toast>(null)
  const { data: video } = useQuery({ queryKey: ['video', id], queryFn: () => api.getVideo(id) })
  const taskId = video?.taskId ?? undefined

  useTaskWs(taskId, id)

  const remove = useMutation({
    mutationFn: () => api.deleteVideo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videos'] })
      router.push('/videos')
    },
    onError: (err) => {
      toast.current?.show({
        severity: 'error',
        summary: 'Delete failed',
        detail: err instanceof Error ? err.message : 'Unknown error',
        life: 5000,
      })
    },
  })

  function confirmDelete() {
    if (!video) return
    confirmDialog({
      message: `Delete "${video.originalFilename}" and all its artifacts? This cannot be undone.`,
      header: 'Delete video',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Delete',
      accept: () => remove.mutate(),
    })
  }

  const cancel = useMutation({
    mutationFn: () => api.cancelVideo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['video', id] })
      qc.invalidateQueries({ queryKey: ['task', taskId] })
      qc.invalidateQueries({ queryKey: ['videos'] })
    },
    onError: (err) => {
      toast.current?.show({
        severity: 'error',
        summary: 'Cancel failed',
        detail: err instanceof Error ? err.message : 'Unknown error',
        life: 5000,
      })
    },
  })

  function confirmCancel() {
    confirmDialog({
      message: 'Stop processing this video? The uploaded source is kept.',
      header: 'Cancel processing',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-warning',
      acceptLabel: 'Cancel processing',
      rejectLabel: 'Keep',
      accept: () => cancel.mutate(),
    })
  }

  const { data: task } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.getTask(taskId as string),
    enabled: !!taskId,
    refetchInterval: (query) => {
      const s = (query.state.data as TaskDetail | undefined)?.status
      const settled = s === 'ready' || s === 'failed' || s === 'cancelled'
      return s && !settled ? 4000 : false
    },
  })

  const canCancel = task?.status === 'queued' || task?.status === 'processing'

  const { data: artifacts } = useQuery({
    queryKey: ['artifacts', id],
    queryFn: () => api.artifacts(id),
    enabled: !!video,
  })

  const rendition = artifacts?.items.find((a) => a.type === 'rendition')
  const done = task?.status === 'ready'
  const meta = video?.metadata ?? null

  return (
    <div className="flex flex-col gap-5">
      <Toast ref={toast} />
      <ConfirmDialog />
      <Link
        href="/videos"
        className="text-brand hover:text-brand-emphasis text-sm w-fit transition-colors"
      >
        <i className="pi pi-arrow-left mr-1 text-xs" /> Videos
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">video · {id.slice(0, 8)}</span>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold break-all">{video?.originalFilename ?? '…'}</h1>
            {video && <Tag value={video.status} severity={statusSeverity(video.status)} />}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canCancel && (
            <Button
              label="Cancel"
              icon="pi pi-ban"
              severity="warning"
              outlined
              loading={cancel.isPending}
              onClick={confirmCancel}
            />
          )}
          {video && (
            <Button
              label="Delete"
              icon="pi pi-trash"
              severity="danger"
              outlined
              loading={remove.isPending}
              onClick={confirmDelete}
            />
          )}
        </div>
      </div>

      {task && task.status !== 'ready' && task.status !== 'cancelled' && (
        <Card>
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between items-baseline">
              <span className="eyebrow">pipeline</span>
              <span className="mono text-sm text-surface-900">{task.progress}%</span>
            </div>
            <ProgressBar value={task.progress} showValue={false} style={{ height: 8 }} />
            <div className="flex flex-wrap gap-1.5 mt-1">
              {task.steps.map((s) => (
                <span
                  key={s.type}
                  className={`mono text-xs px-2 py-1 rounded border ${stepChip(s.status)}`}
                >
                  {s.type} {s.progress}%
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}

      {meta && (
        <Card>
          <div className="eyebrow mb-3">metadata</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-4">
            <Info label="resolution" value={meta.width && meta.height ? `${meta.width}×${meta.height}` : '—'} />
            <Info label="duration" value={meta.duration ? `${meta.duration.toFixed(1)}s` : '—'} />
            <Info label="fps" value={meta.fps?.toString() ?? '—'} />
            <Info label="video codec" value={meta.videoCodec ?? '—'} />
            <Info label="audio codec" value={meta.audioCodec ?? '—'} />
            <Info label="bitrate" value={meta.bitrate ? `${Math.round(meta.bitrate / 1000)} kb/s` : '—'} />
            <Info label="aspect" value={meta.aspectRatio ?? '—'} />
          </div>
        </Card>
      )}

      {done && rendition && (
        <Card>
          <div className="eyebrow mb-3">frame</div>
          <div className="crop-frame inline-block max-w-2xl w-full">
            <span className="crop-tr" />
            <span className="crop-bl" />
            <video controls className="block w-full rounded" src={rendition.downloadUrl} />
          </div>
        </Card>
      )}

      <Card>
        <div className="eyebrow mb-3">artifacts</div>
        <DataTable value={artifacts?.items ?? []} emptyMessage={done ? 'No artifacts.' : 'Processing…'}>
          <Column header="Type" body={(a: Artifact) => <Tag value={a.type} severity="info" />} />
          <Column header="MIME" body={(a: Artifact) => <span className="mono text-sm">{a.mime ?? '—'}</span>} />
          <Column header="Size" body={(a: Artifact) => <span className="mono text-sm">{formatBytes(a.size)}</span>} />
          <Column
            header=""
            body={(a: Artifact) => (
              <a href={a.downloadUrl} target="_blank" rel="noreferrer">
                <Button label="Download" icon="pi pi-download" text size="small" />
              </a>
            )}
          />
        </DataTable>
      </Card>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mono text-surface-900 mt-1">{value}</div>
    </div>
  )
}
