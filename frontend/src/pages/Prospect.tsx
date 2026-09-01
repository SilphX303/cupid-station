import { useCallback, useEffect, useRef, useState } from 'react'
import type { Media } from '../lib/types'
import { useNavigate, useParams } from 'react-router-dom'
import { LcarsButton } from '../components/lcars/Button'
import { AppTag, StatusPill } from '../components/lcars/Pill'
import { SystemPanel } from '../components/lcars/SystemPanel'
import { api } from '../lib/api'
import type { Prospect, Status } from '../lib/types'
import { STATUSES, STATUS_LABEL } from '../lib/types'

const VERDICTS = ['Stellar', 'Good', 'Mixed', 'Poor', 'Disaster'] as const

function DateLog({
  events,
  onAdd,
}: {
  events: { id: number; ts: string; payload: Record<string, unknown> }[]
  onAdd: (payload: Record<string, unknown>) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [on, setOn] = useState(new Date().toISOString().slice(0, 10))
  const [venue, setVenue] = useState('')
  const [verdict, setVerdict] = useState<string>('Good')
  const [green, setGreen] = useState('')
  const [red, setRed] = useState('')
  const [text, setText] = useState('')
  const [next, setNext] = useState('')

  async function submit() {
    if (!venue.trim()) return
    await onAdd({
      on,
      venue: venue.trim(),
      verdict,
      green_flags: green.split(',').map((s) => s.trim()).filter(Boolean),
      red_flags: red.split(',').map((s) => s.trim()).filter(Boolean),
      text: text.trim(),
      next_step: next.trim(),
    })
    setVenue('')
    setGreen('')
    setRed('')
    setText('')
    setNext('')
    setOpen(false)
  }

  return (
    <SystemPanel title="Date log" code={`${String(events.length).padStart(2, '0')} logged`} accent="rose">
      {!open && (
        <LcarsButton accent="rose" onClick={() => setOpen(true)}>
          + Log a date
        </LcarsButton>
      )}
      {open && (
        <div className="mb-3 space-y-2 border-b border-line-faint pb-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="lcars-label">When</span>
              <input type="date" className="lcars-input" value={on} onChange={(e) => setOn(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="lcars-label">Venue / activity</span>
              <input className="lcars-input" value={venue} onChange={(e) => setVenue(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="lcars-label">Verdict</span>
              <select className="lcars-input" value={verdict} onChange={(e) => setVerdict(e.target.value)}>
                {VERDICTS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 sm:col-span-3">
              <span className="lcars-label">Green flags (comma-sep)</span>
              <input className="lcars-input" value={green} onChange={(e) => setGreen(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-3">
              <span className="lcars-label">Red flags (comma-sep)</span>
              <input className="lcars-input" value={red} onChange={(e) => setRed(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-3">
              <span className="lcars-label">How it went</span>
              <textarea className="lcars-input min-h-16" value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-3">
              <span className="lcars-label">Next step</span>
              <input className="lcars-input" value={next} onChange={(e) => setNext(e.target.value)} />
            </label>
          </div>
          <div className="flex gap-2">
            <LcarsButton filled accent="rose" onClick={submit}>
              Log date
            </LcarsButton>
            <LcarsButton accent="mauve" onClick={() => setOpen(false)}>
              Cancel
            </LcarsButton>
          </div>
        </div>
      )}
      <ul className="mt-3 space-y-3">
        {events.map((e) => {
          const pl = e.payload
          return (
            <li key={e.id} className="border-l-2 border-line-hi pl-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="lcars-code">{String(pl.on ?? e.ts.slice(0, 10))}</span>
                <span className="text-xs text-glow">{String(pl.venue ?? '')}</span>
                <span className="lcars-code !text-rose">{String(pl.verdict ?? '')}</span>
              </div>
              {Array.isArray(pl.green_flags) && pl.green_flags.length > 0 && (
                <div className="text-[10px] text-teal">▲ {pl.green_flags.join(' · ')}</div>
              )}
              {Array.isArray(pl.red_flags) && pl.red_flags.length > 0 && (
                <div className="text-[10px] text-alert">▼ {pl.red_flags.join(' · ')}</div>
              )}
              {typeof pl.text === 'string' && pl.text && <div className="text-xs text-dim">{pl.text}</div>}
              {typeof pl.next_step === 'string' && pl.next_step && (
                <div className="text-[10px] uppercase tracking-[0.14em] text-amber">Next: {pl.next_step}</div>
              )}
            </li>
          )
        })}
        {events.length === 0 && (
          <li className="text-[10px] uppercase tracking-[0.16em] text-faint">No dates logged</li>
        )}
      </ul>
    </SystemPanel>
  )
}

function Lightbox({
  media,
  index,
  onClose,
  onNav,
}: {
  media: Media[]
  index: number
  onClose: () => void
  onNav: (i: number) => void
}) {
  const m = media[index]

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && index > 0) onNav(index - 1)
      if (e.key === 'ArrowRight' && index < media.length - 1) onNav(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, media.length, onClose, onNav])

  if (!m) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-space/90 p-4 md:p-8"
      onClick={onClose}
    >
      <div
        className="lcars-panel flex max-h-full max-w-4xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex h-[22px] shrink-0 items-stretch border-b border-line-hi">
          <div className="flex items-center border-r border-line-hi px-2 text-[9px] uppercase tracking-[0.2em] text-mauve">
            Visual record
          </div>
          <div className="flex flex-1 items-center gap-3 px-2">
            <span className="lcars-code">{m.kind.replace('_', ' ')}</span>
            {m.caption && <span className="lcars-code !text-dim">{m.caption}</span>}
          </div>
          <div className="flex items-center gap-1 px-1">
            <button
              className="lcars-pill cursor-pointer px-2 font-mono text-[10px] text-dim disabled:opacity-30"
              disabled={index === 0}
              onClick={() => onNav(index - 1)}
              aria-label="previous"
            >
              ◀
            </button>
            <span className="lcars-code">
              {String(index + 1).padStart(2, '0')}/{String(media.length).padStart(2, '0')}
            </span>
            <button
              className="lcars-pill cursor-pointer px-2 font-mono text-[10px] text-dim disabled:opacity-30"
              disabled={index === media.length - 1}
              onClick={() => onNav(index + 1)}
              aria-label="next"
            >
              ▶
            </button>
            <button
              className="lcars-pill ml-1 cursor-pointer px-2 font-mono text-[10px] text-alert"
              onClick={onClose}
              aria-label="close"
            >
              ✕
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 bg-rail">
          <img
            src={`/media/${m.path}`}
            alt={m.caption || m.kind}
            className="mx-auto max-h-[80vh] w-auto max-w-full object-contain"
          />
        </div>
      </div>
    </div>
  )
}

export function ProspectPage() {
  const { id } = useParams()
  const pid = Number(id)
  const nav = useNavigate()
  const [p, setP] = useState<Prospect | null>(null)
  const [notes, setNotes] = useState('')
  const [noteDirty, setNoteDirty] = useState(false)
  const [question, setQuestion] = useState('')
  const [copied, setCopied] = useState(false)
  const [logText, setLogText] = useState('')
  const [logType, setLogType] = useState<'message_note' | 'note' | 'date'>('message_note')
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadKind, setUploadKind] = useState('photo')
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    display_name: '', nickname: '', age: '', location: '', apps: '', interests: '', looking_for: '',
    prompts: [] as { question: string; answer: string }[],
  })

  function startEdit() {
    if (!p) return
    setForm({
      display_name: p.display_name,
      nickname: p.nickname ?? '',
      age: p.age?.toString() ?? '',
      location: p.location ?? '',
      apps: p.apps.join(', '),
      interests: p.interests.join(', '),
      looking_for: p.looking_for ?? '',
      prompts: p.prompts.map((x) => ({ ...x })),
    })
    setEditing(true)
  }

  async function saveEdit() {
    if (!form.display_name.trim()) return
    await api.patchProspect(pid, {
      display_name: form.display_name.trim(),
      nickname: form.nickname.trim() || null,
      age: form.age ? Number(form.age) : null,
      location: form.location.trim() || null,
      apps: form.apps.split(',').map((s) => s.trim()).filter(Boolean),
      interests: form.interests.split(',').map((s) => s.trim()).filter(Boolean),
      looking_for: form.looking_for.trim() || null,
      prompts: form.prompts.filter((x) => x.question.trim() || x.answer.trim()),
    })
    setEditing(false)
    refresh()
  }

  const load = useCallback(
    () =>
      api.getProspect(pid).then((data) => {
        setP(data)
        setNotes(data.notes)
        setNoteDirty(false)
      }),
    [pid],
  )
  useEffect(() => {
    load().catch(() => nav('/'))
  }, [load, nav])

  if (!p) return null

  const refresh = () => {
    load()
    window.dispatchEvent(new CustomEvent('cupid:refresh'))
  }

  async function setStatus(status: Status) {
    await api.patchProspect(pid, { status })
    refresh()
  }

  async function saveNotes() {
    await api.patchProspect(pid, { notes })
    refresh()
  }

  async function markContact() {
    await api.patchProspect(pid, { last_contact_at: new Date().toISOString().slice(0, 10) })
    refresh()
  }

  async function addLog() {
    if (!logText.trim()) return
    await api.addEvent(pid, { type: logType, payload: { text: logText.trim() } })
    setLogText('')
    refresh()
  }

  async function consult() {
    const { text } = await api.briefing(pid, question)
    await navigator.clipboard.writeText(text)
    await api.addEvent(pid, { type: 'consult', payload: { question } })
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return
    for (const f of Array.from(files)) {
      await api.uploadMedia(pid, f, uploadKind, '')
    }
    refresh()
  }

  return (
    <div className="space-y-4 p-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-3 text-lg text-glow">
          {p.display_name}
          {p.nickname && <span className="text-sm text-salmon">“{p.nickname}”</span>}
          {p.age && <span className="lcars-readout text-sm text-dim">{p.age}</span>}
          <StatusPill status={p.status} />
        </h1>
        <div className="flex gap-2">
          <LcarsButton accent="teal" onClick={markContact}>
            Log contact today
          </LcarsButton>
          <LcarsButton
            accent="alert"
            onClick={async () => {
              if (confirm(`Delete ${p.display_name} and all records?`)) {
                await api.deleteProspect(pid)
                nav('/')
              }
            }}
          >
            Purge
          </LcarsButton>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SystemPanel title="Profile" code={`CPD ${String(pid).padStart(2, '0')}-2026`} accent="amber">
            <div className="mb-2 flex justify-end">
              {!editing ? (
                <LcarsButton accent="mauve" onClick={startEdit}>
                  Edit
                </LcarsButton>
              ) : (
                <div className="flex gap-2">
                  <LcarsButton filled onClick={saveEdit}>
                    Save
                  </LcarsButton>
                  <LcarsButton accent="mauve" onClick={() => setEditing(false)}>
                    Cancel
                  </LcarsButton>
                </div>
              )}
            </div>
            {editing && (
              <div className="mb-3 grid gap-2 border-b border-line-faint pb-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="lcars-label">Name</span>
                  <input className="lcars-input" value={form.display_name}
                    onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="lcars-label">Nickname (disambiguator, e.g. “Gym Sarah”)</span>
                  <input className="lcars-input" value={form.nickname}
                    onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="lcars-label">Age</span>
                  <input className="lcars-input" value={form.age}
                    onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="lcars-label">Location</span>
                  <input className="lcars-input" value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="lcars-label">Apps (comma-sep)</span>
                  <input className="lcars-input" value={form.apps}
                    onChange={(e) => setForm((f) => ({ ...f, apps: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="lcars-label">Interests (comma-sep)</span>
                  <input className="lcars-input" value={form.interests}
                    onChange={(e) => setForm((f) => ({ ...f, interests: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="lcars-label">Looking for</span>
                  <input className="lcars-input" value={form.looking_for}
                    onChange={(e) => setForm((f) => ({ ...f, looking_for: e.target.value }))} />
                </label>
                <div className="sm:col-span-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="lcars-label">Their prompts</span>
                    <LcarsButton accent="teal"
                      onClick={() => setForm((f) => ({ ...f, prompts: [...f.prompts, { question: '', answer: '' }] }))}>
                      + Prompt
                    </LcarsButton>
                  </div>
                  <div className="space-y-1.5">
                    {form.prompts.map((pr, i) => (
                      <div key={i} className="flex gap-1.5">
                        <input className="lcars-input w-2/5" value={pr.question}
                          onChange={(e) => setForm((f) => ({
                            ...f,
                            prompts: f.prompts.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)),
                          }))} />
                        <input className="lcars-input flex-1" value={pr.answer}
                          onChange={(e) => setForm((f) => ({
                            ...f,
                            prompts: f.prompts.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)),
                          }))} />
                        <LcarsButton accent="alert"
                          onClick={() => setForm((f) => ({ ...f, prompts: f.prompts.filter((_, j) => j !== i) }))}>
                          ✕
                        </LcarsButton>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <div className="lcars-label mb-1">Met on</div>
                <div className="flex gap-1">{p.apps.map((a) => <AppTag key={a} app={a} />)}</div>
              </div>
              <div>
                <div className="lcars-label mb-1">Location</div>
                <div className="text-glow">{p.location || '—'}</div>
              </div>
              <div>
                <div className="lcars-label mb-1">Last contact</div>
                <div className="lcars-readout text-glow">{p.last_contact_at || 'never logged'}</div>
              </div>
              <div>
                <div className="lcars-label mb-1">Interests</div>
                <div className="text-glow">{p.interests.join(', ') || '—'}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="lcars-label mb-1">Looking for</div>
                <div className="text-salmon">{p.looking_for || '—'}</div>
              </div>
            </div>
            {p.prompts.length > 0 && (
              <div className="mt-3">
                <div className="lcars-label mb-1">Their prompts</div>
                <ul className="space-y-1.5">
                  {p.prompts.map((pr, i) => (
                    <li key={i} className="border-l-2 border-line-hi pl-2 text-xs">
                      <span className="lcars-code block !text-amber">{pr.question}</span>
                      <span className="text-glow">{pr.answer}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-3">
              <div className="lcars-label mb-1">Notes</div>
              <textarea
                className="lcars-input min-h-24 w-full"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value)
                  setNoteDirty(true)
                }}
              />
              {noteDirty && (
                <LcarsButton className="mt-1" filled onClick={saveNotes}>
                  Save notes
                </LcarsButton>
              )}
            </div>
          </SystemPanel>

          <SystemPanel title="Media" code="Visual records" accent="mauve">
            <div className="mb-3 flex items-center gap-2">
              <select
                className="lcars-input"
                value={uploadKind}
                onChange={(e) => setUploadKind(e.target.value)}
              >
                <option value="photo">photo</option>
                <option value="profile_screenshot">profile screenshot</option>
                <option value="chat_screenshot">chat screenshot</option>
              </select>
              <LcarsButton onClick={() => fileRef.current?.click()}>Upload</LcarsButton>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => upload(e.target.files)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(p.media ?? []).map((m, i) => (
                <div
                  key={m.id}
                  className={`group relative aspect-square overflow-hidden border bg-rail transition-colors hover:border-lavender ${
                    m.is_portrait ? 'border-amber' : 'border-line-hi'
                  }`}
                >
                  <button
                    onClick={() => setLightbox(i)}
                    className="block h-full w-full cursor-pointer"
                  >
                    <img src={`/media/${m.path}`} alt={m.caption} className="h-full w-full object-cover" />
                  </button>
                  <button
                    className={`absolute right-1 top-1 rounded-[2px] bg-space/85 px-1.5 py-0.5 font-mono text-[10px] ${
                      m.is_portrait ? 'text-amber' : 'text-dim opacity-0 group-hover:opacity-100'
                    }`}
                    title="set as portrait"
                    onClick={async () => {
                      await api.setPortrait(m.id)
                      refresh()
                    }}
                  >
                    {m.is_portrait ? '★' : '☆'}
                  </button>
                  <span className="pointer-events-none absolute bottom-0 left-0 right-0 bg-space/80 px-1 py-0.5 text-left text-[7px] uppercase tracking-[0.14em] text-dim opacity-0 group-hover:opacity-100">
                    {m.kind}
                  </span>
                </div>
              ))}
              {(p.media ?? []).length === 0 && (
                <div className="col-span-full text-[10px] uppercase tracking-[0.16em] text-faint">
                  No visual records
                </div>
              )}
            </div>
          </SystemPanel>

          <DateLog
            events={(p.events ?? []).filter((e) => e.type === 'date')}
            onAdd={async (payload) => {
              await api.addEvent(pid, { type: 'date', payload })
              refresh()
            }}
          />

          <SystemPanel title="Timeline" code="Event log" accent="teal">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select
                className="lcars-input"
                value={logType}
                onChange={(e) => setLogType(e.target.value as typeof logType)}
              >
                <option value="message_note">message note</option>
                <option value="note">general note</option>
              </select>
              <input
                className="lcars-input min-w-48 flex-1"
                placeholder="what happened?"
                value={logText}
                onChange={(e) => setLogText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLog()}
              />
              <LcarsButton onClick={addLog}>Log</LcarsButton>
            </div>
            <ul className="space-y-1.5">
              {(p.events ?? []).map((e) => (
                <li key={e.id} className="flex items-baseline gap-2 border-b border-line-faint pb-1.5 text-xs">
                  <span className="lcars-code shrink-0">{e.ts.slice(0, 16)}</span>
                  <span className="lcars-code shrink-0 !text-amber">{e.type.replace('_', ' ')}</span>
                  <span className="min-w-0 text-glow">
                    {e.type === 'status_change'
                      ? `${e.payload.from} → ${e.payload.to}`
                      : e.type === 'date'
                        ? `${e.payload.venue ?? '?'} — ${e.payload.verdict ?? ''}`
                        : String(e.payload.text ?? e.payload.question ?? '')}
                  </span>
                </li>
              ))}
              {(p.events ?? []).length === 0 && (
                <li className="text-[10px] uppercase tracking-[0.16em] text-faint">Log empty</li>
              )}
            </ul>
          </SystemPanel>
        </div>

        <div className="space-y-4">
          <SystemPanel title="Pipeline" code="Comms status" accent="lavender">
            <div className="flex flex-col gap-1.5">
              {STATUSES.filter((s) => s !== 'archived').map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`lcars-pill cursor-pointer px-2 py-1 text-left font-mono text-[9px] uppercase tracking-[0.18em] ${
                    p.status === s ? 'border-lavender bg-blue-faint text-lavender' : 'text-dim'
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </SystemPanel>

          <SystemPanel title="Consult Claude" code="Support crew" accent="rose">
            <p className="mb-2 text-[10px] leading-relaxed text-dim">
              Copies a full briefing — profile, pipeline state, recent log — to the clipboard. Paste
              it into any Claude chat.
            </p>
            <textarea
              className="lcars-input mb-2 min-h-20 w-full"
              placeholder="what do you need help with? reading a message, drafting a reply, decoding signals…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <LcarsButton filled accent="rose" onClick={consult}>
              {copied ? 'Briefing copied ✓' : 'Copy briefing'}
            </LcarsButton>
          </SystemPanel>
        </div>
      </div>

      {lightbox !== null && (p.media ?? []).length > 0 && (
        <Lightbox
          media={p.media ?? []}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNav={setLightbox}
        />
      )}
    </div>
  )
}
