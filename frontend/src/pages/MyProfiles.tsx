import { useEffect, useRef, useState } from 'react'
import { LcarsButton } from '../components/lcars/Button'
import { SystemPanel } from '../components/lcars/SystemPanel'

const KNOWN_APPS = ['hinge', 'mattr', 'bumble']

interface Account {
  app: string
  bio: string
  prompts: { question: string; answer: string }[]
  notes: string
  updated_at?: string
}

const EMPTY = (app: string): Account => ({ app, bio: '', prompts: [], notes: '' })

async function putAccount(acc: Account): Promise<boolean> {
  const res = await fetch(`/api/accounts/${encodeURIComponent(acc.app)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app: acc.app, bio: acc.bio, prompts: acc.prompts, notes: acc.notes }),
  })
  return res.ok
}

function PromptRows({
  prompts,
  onChange,
}: {
  prompts: { question: string; answer: string }[]
  onChange: (p: { question: string; answer: string }[]) => void
}) {
  return (
    <div className="space-y-1.5">
      {prompts.map((pr, i) => (
        <div key={i} className="flex gap-1.5">
          <input
            className="lcars-input w-2/5"
            placeholder="prompt"
            value={pr.question}
            onChange={(e) =>
              onChange(prompts.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))
            }
          />
          <input
            className="lcars-input flex-1"
            placeholder="your answer"
            value={pr.answer}
            onChange={(e) =>
              onChange(prompts.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))
            }
          />
          <LcarsButton accent="alert" onClick={() => onChange(prompts.filter((_, j) => j !== i))}>
            ✕
          </LcarsButton>
        </div>
      ))}
      {prompts.length === 0 && (
        <div className="text-[10px] uppercase tracking-[0.16em] text-faint">No prompts recorded</div>
      )}
    </div>
  )
}

function SelfScan({ knownApps, onSaved }: { knownApps: string[]; onSaved: () => void }) {
  const [visionOk, setVisionOk] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Account | null>(null)
  const [customApp, setCustomApp] = useState('')
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/ingest/status')
      .then((r) => r.json())
      .then((s) => setVisionOk(s.vision_configured))
      .catch(() => setVisionOk(false))
  }, [])

  async function scan(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setMsg('')
    try {
      const fd = new FormData()
      for (const f of Array.from(files)) fd.append('files', f)
      const res = await fetch('/api/ingest/analyze-self', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
      const { draft: d } = await res.json()
      const app = String(d.app ?? '').toLowerCase().trim() || 'hinge'
      setDraft({
        app,
        bio: d.bio ?? '',
        prompts: Array.isArray(d.prompts) ? d.prompts : [],
        notes: d.notes ?? '',
      })
      if (!knownApps.includes(app)) setCustomApp(app)
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save() {
    if (!draft) return
    const app = draft.app === '__custom__' ? customApp.trim().toLowerCase() : draft.app
    if (!app) {
      setMsg('✗ pick or name the app this profile belongs to')
      return
    }
    if (await putAccount({ ...draft, app })) {
      setMsg(`✓ saved to ${app}`)
      setDraft(null)
      onSaved()
    } else {
      setMsg('✗ save failed')
    }
  }

  return (
    <SystemPanel title="Scan my profile" code="Sensor array · self" accent="lavender">
      {visionOk === false && (
        <p className="mb-2 text-[10px] text-amber">
          Sensor array offline — fill the panels in manually below.
        </p>
      )}
      {!draft && (
        <div className="flex items-center gap-3">
          <LcarsButton filled disabled={busy || visionOk === false} onClick={() => fileRef.current?.click()}>
            {busy ? 'Scanning…' : 'Upload my screenshots'}
          </LcarsButton>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => scan(e.target.files)}
          />
          <span className="lcars-label">screenshot your own profile on one app — bio and prompts extract into its panel</span>
        </div>
      )}
      {draft && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="lcars-label">This is my profile on</span>
              <select
                className="lcars-input"
                value={knownApps.includes(draft.app) ? draft.app : '__custom__'}
                onChange={(e) => setDraft((d) => (d ? { ...d, app: e.target.value } : d))}
              >
                {knownApps.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
                <option value="__custom__">another app…</option>
              </select>
            </label>
            {(draft.app === '__custom__' || !knownApps.includes(draft.app)) && (
              <label className="flex flex-col gap-1">
                <span className="lcars-label">App name</span>
                <input
                  className="lcars-input"
                  value={customApp}
                  onChange={(e) => setCustomApp(e.target.value)}
                />
              </label>
            )}
          </div>
          <label className="flex flex-col gap-1">
            <span className="lcars-label">Bio</span>
            <textarea
              className="lcars-input min-h-16 w-full"
              value={draft.bio}
              onChange={(e) => setDraft((d) => (d ? { ...d, bio: e.target.value } : d))}
            />
          </label>
          <div>
            <span className="lcars-label">Prompts</span>
            <PromptRows
              prompts={draft.prompts}
              onChange={(p) => setDraft((d) => (d ? { ...d, prompts: p } : d))}
            />
          </div>
          <label className="flex flex-col gap-1">
            <span className="lcars-label">Notes</span>
            <textarea
              className="lcars-input min-h-12 w-full"
              value={draft.notes}
              onChange={(e) => setDraft((d) => (d ? { ...d, notes: e.target.value } : d))}
            />
          </label>
          <div className="flex gap-2">
            <LcarsButton filled onClick={save}>
              Save profile
            </LcarsButton>
            <LcarsButton accent="mauve" onClick={() => setDraft(null)}>
              Discard
            </LcarsButton>
          </div>
        </div>
      )}
      {msg && (
        <div className={`lcars-readout mt-2 text-[10px] ${msg.startsWith('✓') ? 'text-teal' : 'text-alert'}`}>
          {msg}
        </div>
      )}
    </SystemPanel>
  )
}

function AccountPanel({ initial, onSaved }: { initial: Account; onSaved: () => void }) {
  const [acc, setAcc] = useState<Account>(initial)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setAcc(initial)
    setDirty(false)
  }, [initial])

  const set = (patch: Partial<Account>) => {
    setAcc((a) => ({ ...a, ...patch }))
    setDirty(true)
    setSaved(false)
  }

  async function save() {
    if (await putAccount(acc)) {
      setDirty(false)
      setSaved(true)
      onSaved()
    }
  }

  return (
    <SystemPanel
      title={acc.app}
      code={initial.updated_at ? `Updated ${initial.updated_at.slice(0, 10)}` : 'Not configured'}
      accent="amber"
    >
      <div className="space-y-3">
        <label className="flex flex-col gap-1">
          <span className="lcars-label">Bio</span>
          <textarea
            className="lcars-input min-h-20 w-full"
            value={acc.bio}
            onChange={(e) => set({ bio: e.target.value })}
          />
        </label>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="lcars-label">Prompts</span>
            <LcarsButton
              accent="teal"
              onClick={() => set({ prompts: [...acc.prompts, { question: '', answer: '' }] })}
            >
              + Prompt
            </LcarsButton>
          </div>
          <PromptRows prompts={acc.prompts} onChange={(p) => set({ prompts: p })} />
        </div>
        <label className="flex flex-col gap-1">
          <span className="lcars-label">Notes (photo set, what's working, ideas)</span>
          <textarea
            className="lcars-input min-h-14 w-full"
            value={acc.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </label>
        <div className="flex items-center gap-3">
          {dirty && (
            <LcarsButton filled onClick={save}>
              Save {acc.app}
            </LcarsButton>
          )}
          {saved && <span className="lcars-readout text-[10px] text-teal">✓ saved</span>}
        </div>
      </div>
    </SystemPanel>
  )
}

export function MyProfiles() {
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [extraApps, setExtraApps] = useState<string[]>([])
  const [newApp, setNewApp] = useState('')

  const load = () =>
    fetch('/api/accounts')
      .then((r) => r.json())
      .then(setAccounts)
      .catch(() => setAccounts([]))
  useEffect(() => {
    load()
  }, [])

  if (!accounts) return null
  const byApp = new Map(accounts.map((a) => [a.app, a]))
  const apps = [
    ...KNOWN_APPS,
    ...accounts.map((a) => a.app).filter((a) => !KNOWN_APPS.includes(a)),
    ...extraApps.filter((a) => !KNOWN_APPS.includes(a) && !byApp.has(a)),
  ]

  return (
    <div className="space-y-4 p-1">
      <h1 className="text-lg text-glow">My Profiles</h1>
      <p className="max-w-2xl text-xs leading-relaxed text-dim">
        Your own presence on each app. Consult briefings automatically include the profile for
        the app you matched with someone on — so advice accounts for what your profile says
        about you.
      </p>

      <SelfScan knownApps={apps} onSaved={load} />

      <div className="grid gap-4 lg:grid-cols-2">
        {apps.map((app) => (
          <AccountPanel key={app} initial={byApp.get(app) ?? EMPTY(app)} onSaved={load} />
        ))}
      </div>

      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="lcars-label">Track another app</span>
          <input
            className="lcars-input"
            placeholder="app name"
            value={newApp}
            onChange={(e) => setNewApp(e.target.value)}
          />
        </label>
        <LcarsButton
          accent="teal"
          onClick={() => {
            const a = newApp.trim().toLowerCase()
            if (a && !apps.includes(a)) setExtraApps((x) => [...x, a])
            setNewApp('')
          }}
        >
          + Add
        </LcarsButton>
      </div>
    </div>
  )
}
