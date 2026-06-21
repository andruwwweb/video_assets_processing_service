import type { TagProps } from 'primereact/tag'

/** Maps a domain status (video/task/step/delivery) to a PrimeReact Tag severity. */
export function statusSeverity(s: string): TagProps['severity'] {
  switch (s) {
    case 'ready':
    case 'done':
    case 'delivered':
      return 'success'
    case 'failed':
    case 'dead':
      return 'danger'
    case 'processing':
    case 'uploaded':
    case 'pending':
      return 'info'
    default:
      return 'warning'
  }
}
