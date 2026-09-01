import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LcarsButton } from '../components/lcars/Button'
import { Divider } from '../components/lcars/Divider'
import { AppTag, StatusPill } from '../components/lcars/Pill'
import { SystemPanel } from '../components/lcars/SystemPanel'
import { api } from '../lib/api'
import type { Prospect } from '../lib/types'
import { APPS } from '../lib/types'

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export function Roster() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [app, setApp] = useState<string>('hinge')

  const load = () => api.listProspects().then(setProspects).catch(() => {})
  useEffect(() => {
    load()
  }, [])

  async function create() {
    if (!name.trim()) return
    await api.createProspect({
      display_name: name.trim(),
      age: age ? Number(age) : null,
      apps: [app],
    })
    setName('')
    setAge('')
    setShowNew(false)
    load()
    window.dispatchEvent(new CustomEvent('cupid:refresh'))
  }

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between">
        <h1 className="text-lg text-glow">Duty Roster</h1>
        <LcarsButton accent="amber" onClick={() => setShowNew((v) => !v)}>
          {showNew ? 'Cancel' : '+ New contact'}
        </LcarsButton>
      </div>

      {showNew && (
        <SystemPanel title="New contact" code="CPD REG-NEW" accent="amber">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="lcars-label">Name</span>
              <input className="lcars-input w-40" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="lcars-label">Age</span>
              <input className="lcars-input w-16" value={age} onChange={(e) => setAge(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="lcars-label">App</span>
              <select className="lcars-input" value={app} onChange={(e) => setApp(e.target.value)}>
                {APPS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <LcarsButton filled onClick={create}>
              Register
            </LcarsButton>
          </div>
        </SystemPanel>
      )}

      <Divider />

      {prospects.length === 0 && (
        <SystemPanel title="No contacts" code="CPD 00-0000" accent="mauve">
          <p className="text-xs text-dim">
            Sensors clear. Register a contact above, or ingest a screenshot batch via a Claude
            extraction chat and the Ingest station.
          </p>
        </SystemPanel>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {prospects.map((p) => {
          const d = daysSince(p.last_contact_at)
          const stale = d !== null && d >= 3
          return (
            <Link key={p.id} to={`/prospects/${p.id}`} className="group">
              <SystemPanel
                title={`${p.display_name}${p.age ? ` · ${p.age}` : ''}`}
                code={`CPD ${String(p.id).padStart(2, '0')}-2026`}
                accent="lavender"
                className="transition-colors group-hover:border-lavender"
                pad={false}
              >
                {/* portrait */}
                <div className="relative h-64 w-full overflow-hidden border-b border-line-hi bg-rail">
                  {p.thumb ? (
                    <img
                      src={`/media/${p.thumb.path}`}
                      alt={p.display_name}
                      className="h-full w-full object-cover object-[50%_22%] transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2">
                      <svg viewBox="0 0 24 24" className="h-14 w-14 opacity-40" fill="none"
                        stroke="var(--color-faint)" strokeWidth="1">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 21c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" />
                      </svg>
                      <span className="lcars-code">No visual record</span>
                    </div>
                  )}
                  <div className="absolute right-1.5 top-1.5 rounded-[2px] bg-space/85">
                    <StatusPill status={p.status} />
                  </div>
                </div>
                {/* personnel data */}
                <div className="divide-y divide-line-faint">
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="lcars-label">Location</span>
                    <span className="truncate pl-3 text-xs text-glow">{p.location || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="lcars-label">Last contact</span>
                    <span
                      className={`lcars-readout text-[11px] ${
                        d === null ? 'text-faint' : stale ? 'text-amber' : 'text-glow'
                      }`}
                    >
                      {d === null ? 'never logged' : d === 0 ? 'today' : `T-${d}d`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="lcars-label">Channels</span>
                    <span className="flex gap-1">
                      {p.apps.length ? p.apps.map((a) => <AppTag key={a} app={a} />) : <span className="lcars-code">—</span>}
                    </span>
                  </div>
                </div>
              </SystemPanel>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
