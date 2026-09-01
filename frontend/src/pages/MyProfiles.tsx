import { useEffect, useState } from 'react'
import { LcarsButton } from '../components/lcars/Button'
import { SystemPanel } from '../components/lcars/SystemPanel'
import { APPS } from '../lib/types'

interface Account {
  app: string
  bio: string
  prompts: { question: string; answer: string }[]
  notes: string
  updated_at?: string
}

const EMPTY = (app: string): Account => ({ app, bio: '', prompts: [], notes: '' })

function AccountPanel({ initial, onSaved }: { initial: Account; onSaved: () => void }) {
  const [acc, setAcc] = useState<Account>(initial)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  const set = (patch: Partial<Account>) => {
    setAcc((a) => ({ ...a, ...patch }))
    setDirty(true)
    setSaved(false)
  }

  async function save() {
    const res = await fetch(`/api/accounts/${acc.app}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: acc.app, bio: acc.bio, prompts: acc.prompts, notes: acc.notes }),
    })
    if (res.ok) {
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
          <div className="space-y-1.5">
            {acc.prompts.map((pr, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  className="lcars-input w-2/5"
                  placeholder="prompt"
                  value={pr.question}
                  onChange={(e) =>
                    set({
                      prompts: acc.prompts.map((x, j) =>
                        j === i ? { ...x, question: e.target.value } : x,
                      ),
                    })
                  }
                />
                <input
                  className="lcars-input flex-1"
                  placeholder="your answer"
                  value={pr.answer}
                  onChange={(e) =>
                    set({
                      prompts: acc.prompts.map((x, j) =>
                        j === i ? { ...x, answer: e.target.value } : x,
                      ),
                    })
                  }
                />
                <LcarsButton
                  accent="alert"
                  onClick={() => set({ prompts: acc.prompts.filter((_, j) => j !== i) })}
                >
                  ✕
                </LcarsButton>
              </div>
            ))}
            {acc.prompts.length === 0 && (
              <div className="text-[10px] uppercase tracking-[0.16em] text-faint">No prompts recorded</div>
            )}
          </div>
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

  return (
    <div className="space-y-4 p-1">
      <h1 className="text-lg text-glow">My Profiles</h1>
      <p className="max-w-2xl text-xs leading-relaxed text-dim">
        Your own presence on each app — bio, prompt answers, working notes. Consult briefings
        include the relevant one automatically, so advice accounts for what your profile says
        about you.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {APPS.map((app) => (
          <AccountPanel key={app} initial={byApp.get(app) ?? EMPTY(app)} onSaved={load} />
        ))}
      </div>
    </div>
  )
}
