import { useState } from 'react'
import { LcarsButton } from '../components/lcars/Button'
import { SystemPanel } from '../components/lcars/SystemPanel'
import { api } from '../lib/api'

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
    "interests": ["<from their profile>"],
    "notes": "<bio highlights, prompts and answers, anything notable>"
  },
  "events": [
    { "type": "message_note", "ts": "<YYYY-MM-DD or null>", "payload": { "text": "<summary of the conversation state — who spoke last, tone, open threads>" } }
  ]
}

Judge status from the evidence: a profile I'm browsing with no match confirmed = scouting;
fresh match with no chat = matched; active back-and-forth = chatting; no reply for 3+ days = quiet;
a planned meetup = date_planned. Then I'll paste each block into the station.`

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

      <SystemPanel title="How it works" code="CPD ING-01" accent="amber">
        <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-dim">
          <li>Screenshot profiles or chats on your phone.</li>
          <li>Attach them to any Claude chat with the extraction prompt below.</li>
          <li>Paste each JSON block Claude returns into the receiver and transport.</li>
        </ol>
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
