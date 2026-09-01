import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LcarsButton } from '../components/lcars/Button'
import { AppTag, StatusPill } from '../components/lcars/Pill'
import { SystemPanel } from '../components/lcars/SystemPanel'
import { api } from '../lib/api'
import type { Prospect, Status } from '../lib/types'
import { STATUSES, STATUS_LABEL } from '../lib/types'

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
              {(p.media ?? []).map((m) => (
                <a
                  key={m.id}
                  href={`/media/${m.path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative block aspect-square overflow-hidden border border-line-hi bg-rail"
                >
                  <img src={`/media/${m.path}`} alt={m.caption} className="h-full w-full object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 bg-space/80 px-1 py-0.5 text-[7px] uppercase tracking-[0.14em] text-dim opacity-0 group-hover:opacity-100">
                    {m.kind}
                  </span>
                </a>
              ))}
              {(p.media ?? []).length === 0 && (
                <div className="col-span-full text-[10px] uppercase tracking-[0.16em] text-faint">
                  No visual records
                </div>
              )}
            </div>
          </SystemPanel>

          <SystemPanel title="Timeline" code="Event log" accent="teal">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select
                className="lcars-input"
                value={logType}
                onChange={(e) => setLogType(e.target.value as typeof logType)}
              >
                <option value="message_note">message note</option>
                <option value="date">date log</option>
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
    </div>
  )
}
