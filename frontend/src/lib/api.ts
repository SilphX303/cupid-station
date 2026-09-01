import type { AnalyzeResult, Event, Media, Prospect, Stats } from './types'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: init?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.status === 204 ? (undefined as T) : res.json()
}

export const api = {
  listProspects: () => req<Prospect[]>('/api/prospects'),
  getProspect: (id: number) => req<Prospect>(`/api/prospects/${id}`),
  createProspect: (body: Partial<Prospect>) =>
    req<Prospect>('/api/prospects', { method: 'POST', body: JSON.stringify(body) }),
  patchProspect: (id: number, body: Partial<Prospect>) =>
    req<Prospect>(`/api/prospects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProspect: (id: number) => req<void>(`/api/prospects/${id}`, { method: 'DELETE' }),
  addEvent: (id: number, body: { type: Event['type']; ts?: string; payload: Record<string, unknown> }) =>
    req<Event>(`/api/prospects/${id}/events`, { method: 'POST', body: JSON.stringify(body) }),
  briefing: (id: number, question: string) =>
    req<{ text: string }>(`/api/prospects/${id}/briefing?question=${encodeURIComponent(question)}`),
  uploadMedia: (id: number, file: File, kind: string, caption: string) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', kind)
    fd.append('caption', caption)
    return req<Media>(`/api/prospects/${id}/media`, { method: 'POST', body: fd })
  },
  deleteMedia: (mediaId: number) => req<void>(`/api/media/${mediaId}`, { method: 'DELETE' }),
  importBlob: (blob: unknown) =>
    req<{ action: string; prospect_id: number; events_added: number }>('/api/import', {
      method: 'POST',
      body: JSON.stringify(blob),
    }),
  stats: () => req<Stats>('/api/stats'),
  ingestStatus: () => req<{ vision_configured: boolean }>('/api/ingest/status'),
  ingestAnalyze: (files: File[]) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    return req<AnalyzeResult>('/api/ingest/analyze', { method: 'POST', body: fd })
  },
  ingestCommit: (body: {
    prospect: Record<string, unknown>
    match_name: string | null
    conversation_summary: string | null
    inbox_ids: string[]
    media_kind: string
  }) =>
    req<{ action: string; prospect_id: number; media_attached: number }>('/api/ingest/commit', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
