import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { api } from './lib/api'
import type { Stats } from './lib/types'

const NAV = [
  { to: '/', code: '01', label: 'Roster' },
  { to: '/pipeline', code: '02', label: 'Comms Pipeline' },
  { to: '/import', code: '03', label: 'Ingest' },
  { to: '/ops', code: '04', label: 'Ops' },
  { to: '/me', code: '05', label: 'My Profiles' },
]

function stardate(): string {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const day = Math.floor((now.getTime() - start.getTime()) / 86400000)
  return `${now.getFullYear() - 1700}${String(day).padStart(3, '0')}.${now.getHours()}`
}

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    const load = () => api.stats().then(setStats).catch(() => {})
    load()
    const t = setInterval(load, 60_000)
    window.addEventListener('cupid:refresh', load)
    return () => {
      clearInterval(t)
      window.removeEventListener('cupid:refresh', load)
    }
  }, [])

  const yellowAlert = (stats?.needs_attention ?? 0) > 0

  return (
    <div
      className={`grid h-dvh grid-cols-1 gap-[var(--frame-gap)] overflow-hidden bg-space p-[var(--frame-gap)] md:grid-cols-[var(--frame-rail)_minmax(0,1fr)] grid-rows-[var(--frame-top)_minmax(0,1fr)] md:grid-rows-[var(--frame-top)_minmax(0,1fr)_var(--frame-foot)] ${yellowAlert ? 'yellow-alert' : ''}`}
    >
      {/* header — instrument cells */}
      <header className="col-span-full row-start-1 flex items-stretch border border-line-hi bg-panel text-[9px] uppercase">
        <div className="flex items-center gap-2 border-r border-line-hi px-3">
          <span className="text-[11px] tracking-[0.3em] text-amber">Cupid Station</span>
          <span className="lcars-code hidden sm:inline">CPD 01-2026 · OPS</span>
        </div>
        <div className="hidden items-center border-r border-line-hi px-3 tracking-[0.16em] text-dim md:flex">
          Active daters
          <span className="lcars-readout ml-2 text-[11px] text-lavender">{stats?.active ?? '—'}</span>
        </div>
        <div className="hidden items-center border-r border-line-hi px-3 tracking-[0.16em] text-dim md:flex">
          Awaiting action
          <span
            className={`lcars-readout ml-2 text-[11px] ${yellowAlert ? 'text-amber' : 'text-lavender'}`}
          >
            {stats?.needs_attention ?? '—'}
          </span>
        </div>
        <div className="flex-1 border-r border-line-hi" />
        {yellowAlert && (
          <div className="flex items-center border-r border-line-hi px-3 text-[10px] tracking-[0.2em] text-amber animate-[alert-blink_1s_steps(2)_infinite]">
            Yellow alert
          </div>
        )}
        <div className="flex items-center gap-2 px-3">
          <span className="lcars-label">Stardate</span>
          <span className="lcars-readout text-[10px] text-amber">{stardate()}</span>
        </div>
      </header>

      {/* nav rail */}
      <nav className="col-start-1 row-start-2 hidden flex-col gap-[3px] md:flex">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `relative flex h-[var(--nav-row)] items-center gap-2 rounded-r-[13px] border border-l-0 px-2.5 text-[10px] uppercase tracking-[0.18em] transition-colors ${
                isActive
                  ? 'border-lavender bg-blue-faint text-lavender'
                  : 'border-line-hi text-dim hover:border-lavender hover:text-lavender'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute -left-1 top-1 bottom-1 w-1 rounded-r-sm bg-lavender" />
                )}
                <span className="lcars-readout text-[8px] text-amber">{item.code}</span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
        <div className="mt-auto space-y-1 px-1 pb-1">
          <div className="lcars-code">Duty roster 07</div>
          <div className="lcars-code">CPD 00-2026 · Refit</div>
        </div>
      </nav>

      {/* main */}
      <main className="row-start-2 overflow-y-auto md:col-start-2">
        <div className="mx-auto max-w-5xl pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
        </div>
      </main>

      {/* footer strip */}
      <footer className="col-span-full row-start-3 hidden items-stretch border border-line-hi bg-panel text-[9px] uppercase tracking-[0.16em] text-dim md:flex">
        <div className="flex items-center gap-2 border-r border-line-hi px-3">
          <span className={`alive-dot ${yellowAlert ? '!bg-amber' : ''}`} />
          Systems nominal
        </div>
        <div className="flex items-center border-r border-line-hi px-3">
          Link · cupid.arkadia.network
        </div>
        <div className="flex-1 border-r border-line-hi" />
        <div className="flex items-center px-3">
          <span className="lcars-code">SBS 47-0518 heritage · LCARS refit</span>
        </div>
      </footer>

      {/* mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line-hi bg-panel pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex min-h-12 flex-1 items-center justify-center text-[10px] uppercase tracking-[0.16em] ${
                isActive ? 'text-lavender' : 'text-dim'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
