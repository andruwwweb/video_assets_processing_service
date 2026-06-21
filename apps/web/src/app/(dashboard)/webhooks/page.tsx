'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { WEBHOOK_EVENTS } from '@mpp/core'
import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { Message } from 'primereact/message'
import { MultiSelect } from 'primereact/multiselect'
import { Tag } from 'primereact/tag'
import { api } from '@/lib/api'
import { statusSeverity } from '@/lib/status'
import type { Delivery, Webhook } from '@/lib/types'

const EVENT_OPTIONS = WEBHOOK_EVENTS.map((e) => ({ label: e, value: e }))

export default function WebhooksPage() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['webhooks'], queryFn: api.listWebhooks })
  const [createOpen, setCreateOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>([...WEBHOOK_EVENTS])
  const [secret, setSecret] = useState<string | null>(null)
  const [deliveriesFor, setDeliveriesFor] = useState<string | null>(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['webhooks'] })
  const create = useMutation({
    mutationFn: () => api.createWebhook({ url, events }),
    onSuccess: (r) => {
      setCreateOpen(false)
      setUrl('')
      setSecret(r.secret)
      invalidate()
    },
  })
  const remove = useMutation({ mutationFn: api.deleteWebhook, onSuccess: invalidate })

  const deliveries = useQuery({
    queryKey: ['deliveries', deliveriesFor],
    queryFn: () => api.deliveries(deliveriesFor as string),
    enabled: deliveriesFor !== null,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Webhooks</h1>
        <Button label="New endpoint" icon="pi pi-plus" onClick={() => setCreateOpen(true)} />
      </div>

      <div className="panel">
        <DataTable value={data?.items ?? []} emptyMessage="No webhook endpoints yet.">
          <Column field="url" header="URL" body={(w: Webhook) => <span className="mono text-sm">{w.url}</span>} />
          <Column header="Events" body={(w: Webhook) => <span className="text-sm text-surface-600">{w.events.join(', ')}</span>} />
          <Column header="Active" body={(w: Webhook) => <Tag value={w.active ? 'active' : 'off'} severity={w.active ? 'success' : 'warning'} />} />
          <Column
            header=""
            body={(w: Webhook) => (
              <div className="flex gap-2 justify-end">
                <Button label="Deliveries" text size="small" onClick={() => setDeliveriesFor(w.id)} />
                <Button icon="pi pi-trash" text severity="danger" size="small" onClick={() => remove.mutate(w.id)} />
              </div>
            )}
          />
        </DataTable>
      </div>

      <Dialog header="New webhook endpoint" visible={createOpen} onHide={() => setCreateOpen(false)} className="w-full max-w-md">
        <div className="flex flex-col gap-3 py-2">
          <InputText placeholder="https://example.com/hook" value={url} onChange={(e) => setUrl(e.target.value)} />
          <MultiSelect
            value={events}
            options={EVENT_OPTIONS}
            onChange={(e) => setEvents(e.value)}
            placeholder="Events"
            display="chip"
          />
          <Button label="Create" loading={create.isPending} disabled={!url || events.length === 0} onClick={() => create.mutate()} />
        </div>
      </Dialog>

      <Dialog header="Endpoint created" visible={secret !== null} onHide={() => setSecret(null)} className="w-full max-w-lg">
        <div className="flex flex-col gap-3">
          <Message severity="warn" text="Copy this signing secret now — it won't be shown again." />
          <div className="flex gap-2">
            <InputText value={secret ?? ''} readOnly className="flex-1 font-mono text-sm" />
            <Button icon="pi pi-copy" onClick={() => secret && navigator.clipboard.writeText(secret)} />
          </div>
        </div>
      </Dialog>

      <Dialog header="Delivery history" visible={deliveriesFor !== null} onHide={() => setDeliveriesFor(null)} className="w-full max-w-3xl">
        <DataTable value={deliveries.data?.items ?? []} loading={deliveries.isLoading} emptyMessage="No deliveries yet." paginator rows={10}>
          <Column field="eventType" header="Event" />
          <Column header="Status" body={(d: Delivery) => <Tag value={d.status} severity={statusSeverity(d.status)} />} />
          <Column field="attempt" header="Attempt" />
          <Column header="Code" body={(d: Delivery) => d.responseCode ?? '—'} />
          <Column header="When" body={(d: Delivery) => new Date(d.createdAt).toLocaleString()} />
        </DataTable>
      </Dialog>
    </div>
  )
}
