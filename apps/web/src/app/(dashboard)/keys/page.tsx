'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { Message } from 'primereact/message'
import { Tag } from 'primereact/tag'
import { api } from '@/lib/api'
import { statusSeverity } from '@/lib/status'
import type { ApiKey } from '@/lib/types'

export default function KeysPage() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['keys'], queryFn: api.listKeys })
  const [name, setName] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['keys'] })
  const create = useMutation({
    mutationFn: () => api.createKey({ name }),
    onSuccess: (r) => {
      setCreateOpen(false)
      setName('')
      setCreatedKey(r.key)
      invalidate()
    },
  })
  const disable = useMutation({ mutationFn: api.disableKey, onSuccess: invalidate })
  const remove = useMutation({ mutationFn: api.deleteKey, onSuccess: invalidate })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">API keys</h1>
        <Button label="New key" icon="pi pi-plus" onClick={() => setCreateOpen(true)} />
      </div>

      <div className="panel">
        <DataTable value={data?.items ?? []} emptyMessage="No keys yet.">
          <Column field="name" header="Name" />
          <Column
            field="prefix"
            header="Prefix"
            body={(k: ApiKey) => <span className="mono text-sm">{k.prefix}…</span>}
          />
          <Column header="Status" body={(k: ApiKey) => <Tag value={k.status} severity={statusSeverity(k.status)} />} />
          <Column
            header="Last used"
            body={(k: ApiKey) => (
              <span className="mono text-sm text-surface-600">
                {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : '—'}
              </span>
            )}
          />
          <Column
            header=""
            body={(k: ApiKey) => (
              <div className="flex gap-2 justify-end">
                {k.status === 'active' && (
                  <Button label="Disable" text size="small" onClick={() => disable.mutate(k.id)} />
                )}
                <Button icon="pi pi-trash" text severity="danger" size="small" onClick={() => remove.mutate(k.id)} />
              </div>
            )}
          />
        </DataTable>
      </div>

      <Dialog header="New API key" visible={createOpen} onHide={() => setCreateOpen(false)} className="w-full max-w-md">
        <div className="flex flex-col gap-3 py-2">
          <InputText placeholder="Key name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button label="Create" loading={create.isPending} disabled={!name} onClick={() => create.mutate()} />
        </div>
      </Dialog>

      <Dialog
        header="Key created"
        visible={createdKey !== null}
        onHide={() => setCreatedKey(null)}
        className="w-full max-w-lg"
      >
        <div className="flex flex-col gap-3">
          <Message severity="warn" text="Copy this key now — it won't be shown again." />
          <div className="flex gap-2 px-3">
            <InputText value={createdKey ?? ''} readOnly className="flex-1 font-mono text-sm" />
            <Button
              icon="pi pi-copy"
              onClick={() => createdKey && navigator.clipboard.writeText(createdKey)}
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
