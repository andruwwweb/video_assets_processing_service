'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { TaskEvent } from '@mpp/core'
import type { TaskDetail, TaskStep } from './types'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL

type WsMessage =
  | { type: 'snapshot'; status: string; progress: number; steps: TaskStep[] }
  | TaskEvent

function upsertStep(steps: TaskStep[], type: string, progress: number): TaskStep[] {
  return steps.some((s) => s.type === type)
    ? steps.map((s) => (s.type === type ? { ...s, progress } : s))
    : [...steps, { type, status: 'processing', progress }]
}

/**
 * Subscribes to a task's real-time events (stage 3) and feeds them into the
 * TanStack Query cache: live progress without polling, artifacts invalidated
 * as they appear. The JWT cookie authenticates the WS handshake.
 */
export function useTaskWs(taskId: string | undefined, videoId?: string): void {
  const qc = useQueryClient()
  useEffect(() => {
    if (!taskId || !WS_URL) return
    const ws = new WebSocket(`${WS_URL}/v1/tasks/${taskId}/ws`)

    ws.onmessage = (ev) => {
      let msg: WsMessage
      try {
        msg = JSON.parse(ev.data as string) as WsMessage
      } catch {
        return
      }
      const setTask = (fn: (t: TaskDetail) => TaskDetail) =>
        qc.setQueryData<TaskDetail>(['task', taskId], (old) => (old ? fn(old) : old))

      switch (msg.type) {
        case 'snapshot':
          qc.setQueryData<TaskDetail>(['task', taskId], {
            id: taskId,
            status: msg.status,
            progress: msg.progress,
            steps: msg.steps,
          })
          break
        case 'task.started':
          setTask((t) => ({ ...t, status: 'processing' }))
          break
        case 'task.progress':
          setTask((t) => ({
            ...t,
            status: 'processing',
            progress: msg.progress,
            steps: upsertStep(t.steps, msg.step, msg.stepProgress),
          }))
          break
        case 'artifact.created':
          if (videoId) qc.invalidateQueries({ queryKey: ['artifacts', videoId] })
          break
        case 'task.completed':
          setTask((t) => ({ ...t, status: 'ready', progress: 100 }))
          if (videoId) {
            qc.invalidateQueries({ queryKey: ['artifacts', videoId] })
            qc.invalidateQueries({ queryKey: ['video', videoId] })
          }
          break
        case 'task.failed':
          setTask((t) => ({ ...t, status: 'failed' }))
          if (videoId) qc.invalidateQueries({ queryKey: ['video', videoId] })
          break
      }
    }

    return () => ws.close()
  }, [taskId, videoId, qc])
}
