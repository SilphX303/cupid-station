import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LcarsButton } from '../components/lcars/Button'
import { Divider } from '../components/lcars/Divider'
import { AppTag, StatusPill } from '../components/lcars/Pill'
import { SystemPanel } from '../components/lcars/SystemPanel'
import { api } from '../lib/api'
import type { Prospect, Status } from '../lib/types'
import { APPS, STATUSES, STATUS_LABEL } from '../lib/types'

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const d = Math.ceil((new Date(iso + 'T00:00:00').getTime() - Date.now()) / 86400000)
  return d < 0 ? null : d // past dates fall off the card
}

export function Roster() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [app, setApp] = useState<string>('hinge')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')
  const [appFilter, setAppFilter] = useState<string>('all')
  const [sort, setSort] = useState<'recent' | 'name' | 'age' | 'newest'>('recent')

  const load = () => api.listProspects().then(setProspects).catch(() => {})
  useEffect(() => {
    load()
  }, [])

  const q = query.trim().toLowerCase()
  const appsInUse = [...new Set(prospects.flatMap((p) => p.apps))].sort()
  const filtered = prospects
    .filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (appFilter !== 'all' && !p.apps.includes(appFilter)) return false
      if (!q) return true
      const hay = [p.display_name, p.nickname, p.location, p.notes, p.looking_for, ...p.apps, ...p.interests]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
    .sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.display_name.localeCompare(b.display_name)
        case 'age':
          return (a.age ?? 999) - (b.age ?? 999)
        case 'newest':
          return b.created_at.localeCompare(a.created_at)
        default: // recent contact first, never-contacted last
          return (b.last_contact_at ?? '').localeCompare(a.last_contact_at ?? '')
      }
    })

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

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="lcars-input w-56"
          placeholder="search name, place, interests…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="lcars-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as Status | 'all')}
        >
          <option value="all">all statuses</option>
          {STATUSES.filter((s) => s !== 'archived').map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select className="lcars-input" value={appFilter} onChange={(e) => setAppFilter(e.target.value)}>
          <option value="all">all apps</option>
          {appsInUse.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select className="lcars-input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="recent">recent contact</option>
          <option value="newest">newest</option>
          <option value="name">name</option>
          <option value="age">age</option>
        </select>
        {(query || statusFilter !== 'all' || appFilter !== 'all') && (
          <span className="lcars-code">
            {filtered.length}/{prospects.length} shown
          </span>
        )}
      </div>

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
        {filtered.map((p) => {
          const d = daysSince(p.last_contact_at)
          const stale = d !== null && d >= 3
          const du = daysUntil(p.next_date_at)
          return (
            <Link key={p.id} to={`/prospects/${p.id}`} className="group">
              <SystemPanel
                title={`${p.display_name}${p.nickname ? ` “${p.nickname}”` : ''}${p.age ? ` · ${p.age}` : ''}`}
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
                  {du !== null && (
                    <div className="flex items-center justify-between px-3 py-1.5">
                      <span className="lcars-label">Next date</span>
                      <span
                        className={`lcars-readout text-[11px] text-rose ${du === 0 ? 'animate-[alert-blink_1s_steps(2)_infinite]' : ''}`}
                      >
                        {du === 0 ? 'TODAY' : du === 1 ? 'tomorrow' : `T-${du}d`}
                      </span>
                    </div>
                  )}
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
