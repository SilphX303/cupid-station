import type { Status } from '../../lib/types'
import { STATUS_COLOR, STATUS_LABEL } from '../../lib/types'

export function StatusPill({ status }: { status: Status }) {
  const c = STATUS_COLOR[status]
  return (
    <span
      className="lcars-pill inline-flex items-center px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]"
      style={{ color: `var(--color-${c})`, borderColor: `var(--color-${c})` }}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

export function AppTag({ app }: { app: string }) {
  return (
    <span className="lcars-code border border-line px-1.5 py-0.5 text-[8px]">{app}</span>
  )
}
