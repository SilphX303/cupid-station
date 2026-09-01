import { useEffect, useRef, useState } from 'react'
import { LcarsButton } from '../components/lcars/Button'
import { SystemPanel } from '../components/lcars/SystemPanel'
import { api } from '../lib/api'
import type { AnalyzeResult, Draft, Status } from '../lib/types'
import { STATUSES, STATUS_LABEL } from '../lib/types'

const EXTRACTION_PROMPT = `I'm attaching dating-app screenshots (profile pages and/or chat threads).
Extract the details into Cupid Station import JSON — one JSON code block per person, exactly this shape:

{
  "match_name": "<person's first name — lets the station update them if they already exist>",
  "prospect": {
    "display_name": "<first name>",
    "age": <number or null>,
    "location": "<text or null>",
    "apps": ["hinge" | "mattr" | "bumble" | "other"],
    "status": "scouting" | "matched" | "chatting" | "quiet" | "ghosted" | "date_planned" | "dating" | "ended",
    "last_contact_at": "<YYYY-MM-DD of the latest visible message, or null>",
    "looking_for": "<their stated dating intentions, or null>",
    "interests": ["<from their profile>"],
    "prompts": [{"question": "<prompt title>", "answer": "<their answer>"}],
    "notes": "<bio highlights, anything notable>"
  },
  "events": [
    { "type": "message_note", "ts": "<YYYY-MM-DD or null>", "payload": { "text": "<summary of the conversation state — who spoke last, tone, open threads>" } }
  ]
}

Judge status from the evidence: a profile I'm browsing with no match confirmed = scouting;
fresh match with no chat = matched; active back-and-forth = chatting; no reply for 3+ days = quiet;
a planned meetup = date_planned. Then I'll paste each block into the station.`

function Field({
  label,
  value,
  onChange,
  wide = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  wide?: boolean
}) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="lcars-label">{label}</span>
      <input className="lcars-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function VisualScan() {
  const [visionOk, setVisionOk] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [scan, setScan] = useState<AnalyzeResult | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [useMatch, setUseMatch] = useState(true)
  const [keptCrops, setKeptCrops] = useState<string[]>([])
  const [portraitId, setPortraitId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.ingestStatus().then((s) => setVisionOk(s.vision_configured)).catch(() => setVisionOk(false))
  }, [])

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  async function analyze(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setMsg('')
    try {
      const r = await api.ingestAnalyze(Array.from(files))
      setScan(r)
      setDraft(r.draft)
      setUseMatch(r.existing_match !== null)
      setKeptCrops(r.crop_ids)
      setPortraitId(r.crop_ids[0] ?? null)
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function commit() {
    if (!scan || !draft || !draft.display_name?.trim()) {
      setMsg('✗ a name is required — fill it in above')
      return
    }
    setBusy(true)
    try {
      const r = await api.ingestCommit({
        prospect: {
          display_name: draft.display_name.trim(),
          age: draft.age,
          location: draft.location,
          apps: draft.apps,
          status: draft.status,
          last_contact_at: draft.last_contact_at,
          looking_for: draft.looking_for,
          interests: draft.interests,
          prompts: draft.prompts,
          notes: draft.notes ?? '',
        },
        match_name: useMatch && scan.existing_match ? scan.existing_match.display_name : null,
        conversation_summary: draft.conversation_summary,
        inbox_ids: scan.inbox_ids,
        media_kind: draft.conversation_summary ? 'chat_screenshot' : 'profile_screenshot',
        crop_ids: keptCrops,
        portrait_id: portraitId && keptCrops.includes(portraitId) ? portraitId : null,
      })
      setMsg(`✓ ${r.action} prospect #${r.prospect_id}, ${r.media_attached} screenshot(s) attached`)
      setScan(null)
      setDraft(null)
      window.dispatchEvent(new CustomEvent('cupid:refresh'))
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SystemPanel title="Visual scan" code="Sensor array" accent="lavender">
      {visionOk === false && (
        <p className="mb-2 text-[10px] leading-relaxed text-amber">
          Sensor array offline — set CUPID_VISION_BASE_URL / CUPID_VISION_MODEL on the container to
          enable in-app extraction. The receiver below works regardless.
        </p>
      )}
      {!draft && (
        <div className="flex items-center gap-3">
          <LcarsButton
            filled
            disabled={busy || visionOk === false}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? 'Scanning…' : 'Upload screenshots'}
          </LcarsButton>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => analyze(e.target.files)}
          />
          <span className="lcars-label">one person per scan — profile pages and/or chat threads</span>
        </div>
      )}

      {draft && scan && (
        <div className="space-y-3">
          {scan.crop_ids.length === 0 && (
            <p className="text-[10px] uppercase tracking-[0.16em] text-faint">
              No photos could be cut out of this screenshot — the originals still attach below.
            </p>
          )}
          {scan.crop_ids.length > 0 && (
            <div>
              <div className="lcars-label mb-1">
                Extracted photos — tick to keep, star one as portrait
              </div>
              <div className="flex flex-wrap gap-2">
                {scan.crop_ids.map((cid) => {
                  const kept = keptCrops.includes(cid)
                  const isPortrait = portraitId === cid && kept
                  return (
                    <div
                      key={cid}
                      className={`relative w-28 overflow-hidden border transition-colors ${
                        isPortrait
                          ? 'border-amber'
                          : kept
                            ? 'border-lavender'
                            : 'border-line-hi opacity-40'
                      }`}
                    >
                      <button
                        className="block h-32 w-full cursor-pointer bg-rail"
                        title={kept ? 'click to discard' : 'click to keep'}
                        onClick={() =>
                          setKeptCrops((k) =>
                            k.includes(cid) ? k.filter((x) => x !== cid) : [...k, cid],
                          )
                        }
                      >
                        <img
                          src={`/api/ingest/inbox/${cid}`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </button>
                      <button
                        className={`absolute right-1 top-1 rounded-[2px] bg-space/85 px-1.5 py-0.5 font-mono text-[10px] ${
                          isPortrait ? 'text-amber' : 'text-dim'
                        }`}
                        title="set as portrait"
                        onClick={() => {
                          if (!keptCrops.includes(cid)) setKeptCrops((k) => [...k, cid])
                          setPortraitId(cid)
                        }}
                      >
                        {isPortrait ? '★' : '☆'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {scan.existing_match && (
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-amber">
              <input
                type="checkbox"
                checked={useMatch}
                onChange={(e) => setUseMatch(e.target.checked)}
              />
              Update existing contact “{scan.existing_match.display_name}” (
              {STATUS_LABEL[scan.existing_match.status]}) instead of creating new
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" value={draft.display_name ?? ''} onChange={(v) => set({ display_name: v })} />
            <Field
              label="Age"
              value={draft.age?.toString() ?? ''}
              onChange={(v) => set({ age: v ? Number(v) : null })}
            />
            <Field label="Location" value={draft.location ?? ''} onChange={(v) => set({ location: v })} />
            <Field
              label="Apps (comma-sep)"
              value={draft.apps.join(', ')}
              onChange={(v) => set({ apps: v.split(',').map((s) => s.trim()).filter(Boolean) })}
            />
            <label className="flex flex-col gap-1">
              <span className="lcars-label">Status</span>
              <select
                className="lcars-input"
                value={draft.status}
                onChange={(e) => set({ status: e.target.value as Status })}
              >
                {STATUSES.filter((s) => s !== 'archived').map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Last contact (YYYY-MM-DD)"
              value={draft.last_contact_at ?? ''}
              onChange={(v) => set({ last_contact_at: v || null })}
            />
            <Field
              label="Looking for"
              value={draft.looking_for ?? ''}
              onChange={(v) => set({ looking_for: v || null })}
              wide
            />
            <Field
              label="Interests (comma-sep)"
              value={draft.interests.join(', ')}
              onChange={(v) => set({ interests: v.split(',').map((s) => s.trim()).filter(Boolean) })}
              wide
            />
          </div>

          {draft.prompts.length > 0 && (
            <div>
              <div className="lcars-label mb-1">Profile prompts</div>
              <div className="space-y-1.5">
                {draft.prompts.map((pr, i) => (
                  <div key={i} className="flex gap-1.5">
                    <input
                      className="lcars-input w-2/5"
                      value={pr.question}
                      onChange={(e) =>
                        set({
                          prompts: draft.prompts.map((x, j) =>
                            j === i ? { ...x, question: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <input
                      className="lcars-input flex-1"
                      value={pr.answer}
                      onChange={(e) =>
                        set({
                          prompts: draft.prompts.map((x, j) =>
                            j === i ? { ...x, answer: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <LcarsButton
                      accent="alert"
                      onClick={() => set({ prompts: draft.prompts.filter((_, j) => j !== i) })}
                    >
                      ✕
                    </LcarsButton>
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="lcars-label">Notes</span>
            <textarea
              className="lcars-input min-h-16 w-full"
              value={draft.notes ?? ''}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </label>
          {draft.conversation_summary && (
            <label className="flex flex-col gap-1">
              <span className="lcars-label">Conversation summary (logged to timeline)</span>
              <textarea
                className="lcars-input min-h-14 w-full"
                value={draft.conversation_summary}
                onChange={(e) => set({ conversation_summary: e.target.value || null })}
              />
            </label>
          )}

          <div className="flex items-center gap-3">
            <LcarsButton filled disabled={busy} onClick={commit}>
              {busy ? 'Committing…' : 'Commit to roster'}
            </LcarsButton>
            <LcarsButton
              accent="mauve"
              onClick={() => {
                setScan(null)
                setDraft(null)
                setMsg('')
              }}
            >
              Discard
            </LcarsButton>
          </div>
        </div>
      )}
      {msg && (
        <div
          className={`lcars-readout mt-2 text-[10px] ${msg.startsWith('✓') ? 'text-teal' : 'text-alert'}`}
        >
          {msg}
        </div>
      )}
    </SystemPanel>
  )
}

export function ImportPage() {
  const [blob, setBlob] = useState('')
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)

  async function run() {
    setResult('')
    try {
      // accept either a bare object or a ```json fenced block pasted straight from chat
      const cleaned = blob.replace(/^```(json)?/m, '').replace(/```\s*$/m, '').trim()
      const r = await api.importBlob(JSON.parse(cleaned))
      setResult(`✓ ${r.action} prospect #${r.prospect_id}, ${r.events_added} event(s) logged`)
      setBlob('')
      window.dispatchEvent(new CustomEvent('cupid:refresh'))
    } catch (e) {
      setResult(`✗ ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <div className="space-y-4 p-1">
      <h1 className="text-lg text-glow">Ingest</h1>

      <VisualScan />

      <SystemPanel title="Fallback: extraction via chat" code="CPD ING-01" accent="amber">
        <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-dim">
          <li>Screenshot profiles or chats on your phone.</li>
          <li>Attach them to any Claude chat with the extraction prompt below.</li>
          <li>Paste each JSON block Claude returns into the receiver and transport.</li>
        </ol>
        <p className="mt-2 text-[10px] text-faint">
          Use this when the sensor array is offline or you want Claude's judgment on a tricky read.
        </p>
        <div className="mt-3">
          <LcarsButton
            accent="amber"
            onClick={async () => {
              await navigator.clipboard.writeText(EXTRACTION_PROMPT)
              setCopied(true)
              setTimeout(() => setCopied(false), 2500)
            }}
          >
            {copied ? 'Prompt copied ✓' : 'Copy extraction prompt'}
          </LcarsButton>
        </div>
      </SystemPanel>

      <SystemPanel title="Receiver" code="Transporter room" accent="lavender">
        <textarea
          className="lcars-input min-h-56 w-full"
          placeholder='paste the JSON block from your extraction chat here…'
          value={blob}
          onChange={(e) => setBlob(e.target.value)}
        />
        <div className="mt-2 flex items-center gap-3">
          <LcarsButton filled onClick={run} disabled={!blob.trim()}>
            Energize
          </LcarsButton>
          {result && (
            <span
              className={`lcars-readout text-[10px] ${result.startsWith('✓') ? 'text-teal' : 'text-alert'}`}
            >
              {result}
            </span>
          )}
        </div>
      </SystemPanel>
    </div>
  )
}
