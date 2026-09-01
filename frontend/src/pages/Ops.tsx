import { useEffect, useState } from 'react'
import { StatusPill } from '../components/lcars/Pill'
import { SystemPanel } from '../components/lcars/SystemPanel'
import type { Status } from '../lib/types'
import { STATUSES } from '../lib/types'

/* Chart discipline (see dataviz method): bars are magnitude, so every chart is
   single-hue; identity is carried by text labels / status pills, never by hue
   adjacency — the desaturated LCARS palette can't support that and shouldn't. */

interface Detail {
  by_status: Record<string, number>
  by_app: { app: string; n: number }[]
  staleness: Record<string, number>
  totals: { prospects: number; active: number; dates_logged: number; consults: number }
  recent: { new_7d: number; events_30d: number }
}

function Tile({ label, value, accent = 'lavender' }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="lcars-panel flex flex-col items-start gap-1 p-3">
      <span className="lcars-label">{label}</span>
      <span className="lcars-readout text-2xl" style={{ color: `var(--color-${accent})` }}>
        {value}
      </span>
    </div>
  )
}

function BarRow({
  label,
  n,
  max,
  accent,
  pill,
}: {
  label: string
  n: number
  max: number
  accent: string
  pill?: Status
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0">
        {pill ? <StatusPill status={pill} /> : <span className="lcars-label">{label}</span>}
      </span>
      <div className="bar-track h-2.5 flex-1">
        <div
          className="bar-fill"
          style={{
            width: `${max ? Math.max(n > 0 ? 2 : 0, (n / max) * 100) : 0}%`,
            background: `var(--color-${accent})`,
            color: `var(--color-${accent})`,
          }}
        />
      </div>
      <span className="lcars-readout w-8 shrink-0 text-right text-[11px] text-glow">{n}</span>
    </div>
  )
}

export function Ops() {
  const [d, setD] = useState<Detail | null>(null)
  useEffect(() => {
    fetch('/api/stats/detail')
      .then((r) => r.json())
      .then(setD)
      .catch(() => {})
  }, [])

  if (!d) return null

  const funnel = STATUSES.filter((s) => s !== 'archived')
  const maxStatus = Math.max(1, ...funnel.map((s) => d.by_status[s] ?? 0))
  const maxApp = Math.max(1, ...d.by_app.map((a) => a.n))
  const buckets = ['today', '1-3d', '4-7d', '8d+', 'never'] as const
  const maxBucket = Math.max(1, ...buckets.map((b) => d.staleness[b] ?? 0))

  return (
    <div className="space-y-4 p-1">
      <h1 className="text-lg text-glow">Ops</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Tile label="Contacts" value={d.totals.prospects} />
        <Tile label="Active daters" value={d.totals.active} />
        <Tile label="New · 7 days" value={d.recent.new_7d} accent="teal" />
        <Tile label="Dates logged" value={d.totals.dates_logged} accent="rose" />
        <Tile label="Consults" value={d.totals.consults} accent="rose" />
        <Tile label="Events · 30 days" value={d.recent.events_30d} accent="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SystemPanel title="Pipeline" code="Funnel by status" accent="lavender">
          <div className="space-y-2">
            {funnel.map((s) => (
              <BarRow key={s} label={s} pill={s} n={d.by_status[s] ?? 0} max={maxStatus} accent="lavender" />
            ))}
          </div>
        </SystemPanel>

        <div className="space-y-4">
          <SystemPanel title="Channels" code="Contacts per app" accent="teal">
            <div className="space-y-2">
              {d.by_app.length === 0 && <span className="lcars-code">No data</span>}
              {d.by_app.map((a) => (
                <BarRow key={a.app} label={a.app} n={a.n} max={maxApp} accent="teal" />
              ))}
            </div>
          </SystemPanel>

          <SystemPanel title="Contact staleness" code="Active pipeline only" accent="amber">
            <div className="space-y-2">
              {buckets.map((b) => (
                <BarRow key={b} label={b} n={d.staleness[b] ?? 0} max={maxBucket} accent="amber" />
              ))}
            </div>
            <p className="mt-2 text-[9px] uppercase tracking-[0.16em] text-faint">
              8d+ and never are where matches go to die — yellow alert fires at 3 days
            </p>
          </SystemPanel>
        </div>
      </div>
    </div>
  )
}
