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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {prospects.map((p) => {
          const d = daysSince(p.last_contact_at)
          const stale = d !== null && d >= 3
          return (
            <Link key={p.id} to={`/prospects/${p.id}`} className="group">
              <SystemPanel
                title={p.display_name}
                code={`CPD ${String(p.id).padStart(2, '0')}-2026`}
                accent="lavender"
                className="transition-colors group-hover:border-lavender"
                pad={false}
              >
                <div className="flex gap-3 p-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden border border-line-hi bg-rail">
                    {p.thumb ? (
                      <img
                        src={`/media/${p.thumb.path}`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[8px] text-faint">
                        NO IMG
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-glow">
                      {p.display_name}
                      {p.age && <span className="lcars-readout text-[10px] text-dim">{p.age}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {p.apps.map((a) => (
                        <AppTag key={a} app={a} />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={p.status} />
                      {d !== null && (
                        <span
                          className={`lcars-readout text-[9px] ${stale ? 'text-amber' : 'text-faint'}`}
                        >
                          T-{d}d
                        </span>
                      )}
                    </div>
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
