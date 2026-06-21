'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { DataTable } from 'primereact/datatable'
import { FileUpload, type FileUploadHandlerEvent } from 'primereact/fileupload'
import { Tag } from 'primereact/tag'
import { Toast } from 'primereact/toast'
import { api, uploadFile } from '@/lib/api'
import type { VideoItem } from '@/lib/types'
import { statusSeverity } from '@/lib/status'

export default function VideosPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const toast = useRef<Toast>(null)
  const { data, isLoading } = useQuery({ queryKey: ['videos'], queryFn: api.listVideos })

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { videoId, uploadUrl } = await api.createVideo({ filename: file.name })
      await uploadFile(uploadUrl, file)
      await api.completeVideo(videoId)
      return videoId
    },
    onSuccess: (videoId) => {
      qc.invalidateQueries({ queryKey: ['videos'] })
      router.push(`/videos/${videoId}`)
    },
    onError: (err) => {
      toast.current?.show({
        severity: 'error',
        summary: 'Upload failed',
        detail: err instanceof Error ? err.message : 'Unknown error',
        life: 5000,
      })
    },
  })

  function onUpload(e: FileUploadHandlerEvent) {
    const file = e.files[0]
    if (file) upload.mutate(file)
  }

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteVideo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['videos'] }),
    onError: (err) => {
      toast.current?.show({
        severity: 'error',
        summary: 'Delete failed',
        detail: err instanceof Error ? err.message : 'Unknown error',
        life: 5000,
      })
    },
  })

  function confirmDelete(v: VideoItem) {
    confirmDialog({
      message: `Delete "${v.originalFilename}" and all its artifacts? This cannot be undone.`,
      header: 'Delete video',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Delete',
      accept: () => remove.mutate(v.id),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Toast ref={toast} />
      <ConfirmDialog />
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">library</span>
          <h1 className="text-2xl font-semibold">Videos</h1>
        </div>
        <FileUpload
          mode="basic"
          customUpload
          auto
          chooseLabel={upload.isPending ? 'Uploading…' : 'Upload video'}
          chooseOptions={{ icon: 'pi pi-upload' }}
          accept="video/*"
          disabled={upload.isPending}
          uploadHandler={onUpload}
        />
      </div>

      <div className="panel">
        <DataTable
          value={data?.items ?? []}
          loading={isLoading}
          emptyMessage="No videos yet — upload one."
          onRowClick={(e) => router.push(`/videos/${(e.data as VideoItem).id}`)}
          rowClassName={() => 'cursor-pointer'}
          paginator
          rows={10}
        >
          <Column field="originalFilename" header="File" />
        <Column
          header="Status"
          body={(v: VideoItem) => <Tag value={v.status} severity={statusSeverity(v.status)} />}
        />
        <Column
          header="Created"
          body={(v: VideoItem) => (
            <span className="mono text-sm text-surface-600">
              {new Date(v.createdAt).toLocaleString()}
            </span>
          )}
        />
        <Column
          header=""
          align="right"
          body={(v: VideoItem) => (
            <Button
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              aria-label="Delete"
              loading={remove.isPending && remove.variables === v.id}
              onClick={(e) => {
                e.stopPropagation()
                confirmDelete(v)
              }}
            />
          )}
        />
        </DataTable>
      </div>
    </div>
  )
}
