import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusPill } from '../components/lcars/Pill'
import { SystemPanel } from '../components/lcars/SystemPanel'
import { api } from '../lib/api'
import type { Prospect, Status } from '../lib/types'
import { STATUS_COLOR, STATUS_LABEL } from '../lib/types'

const COLUMNS: Status[] = ['scouting', 'matched', 'chatting', 'quiet', 'date_planned', 'dating']
const PARKED: Status[] = ['ghosted', 'ended']

function Card({ p }: { p: Prospect }) {
  const days = p.last_contact_at
    ? Math.floor((Date.now() - new Date(p.last_contact_at).getTime()) / 86400000)
    : null
  return (
    <Link
      to={`/prospects/${p.id}`}
      className="lcars-pill block px-2 py-1.5 text-xs text-glow hover:!text-lavender"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">{p.display_name}</span>
        {days !== null && (
          <span className={`lcars-readout text-[9px] ${days >= 3 ? 'text-amber' : 'text-faint'}`}>
            T-{days}d
          </span>
        )}
      </div>
      <div className="lcars-code mt-0.5">{p.apps.join(' · ') || '—'}</div>
    </Link>
  )
}

export function Pipeline() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  useEffect(() => {
    api.listProspects().then(setProspects).catch(() => {})
  }, [])

  return (
    <div className="space-y-4 p-1">
      <h1 className="text-lg text-glow">Comms Pipeline</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {COLUMNS.map((s) => {
          const items = prospects.filter((p) => p.status === s)
          return (
            <SystemPanel
              key={s}
              title={STATUS_LABEL[s]}
              code={String(items.length).padStart(2, '0')}
              accent={STATUS_COLOR[s]}
              pad={false}
            >
              <div className="flex min-h-24 flex-col gap-1.5 p-2">
                {items.map((p) => (
                  <Card key={p.id} p={p} />
                ))}
              </div>
            </SystemPanel>
          )
        })}
      </div>
      <SystemPanel title="Parked" code="Cold storage" accent="mauve">
        <div className="flex flex-wrap gap-2">
          {prospects
            .filter((p) => PARKED.includes(p.status))
            .map((p) => (
              <Link key={p.id} to={`/prospects/${p.id}`} className="flex items-center gap-2 text-xs text-dim hover:text-lavender">
                {p.display_name} <StatusPill status={p.status} />
              </Link>
            ))}
          {prospects.filter((p) => PARKED.includes(p.status)).length === 0 && (
            <span className="text-[10px] uppercase tracking-[0.16em] text-faint">Empty</span>
          )}
        </div>
      </SystemPanel>
    </div>
  )
}
