export type Status =
  | 'scouting' | 'matched' | 'chatting' | 'quiet' | 'ghosted'
  | 'date_planned' | 'dating' | 'ended' | 'archived'

export interface Media {
  id: number
  prospect_id?: number
  path: string
  kind: 'photo' | 'profile_screenshot' | 'chat_screenshot'
  caption?: string
  created_at?: string
}

export interface Event {
  id: number
  prospect_id: number
  ts: string
  type: 'status_change' | 'message_note' | 'date' | 'consult' | 'note'
  payload: Record<string, unknown>
}

export interface Prospect {
  id: number
  display_name: string
  age: number | null
  location: string | null
  apps: string[]
  status: Status
  last_contact_at: string | null
  interests: string[]
  notes: string
  created_at: string
  archived_at: string | null
  thumb?: { id: number; path: string; kind: string } | null
  media?: Media[]
  events?: Event[]
}

export interface Stats {
  by_status: Record<string, number>
  active: number
  needs_attention: number
}

export const STATUSES: Status[] = [
  'scouting', 'matched', 'chatting', 'quiet', 'ghosted', 'date_planned', 'dating', 'ended', 'archived',
]

export const STATUS_LABEL: Record<Status, string> = {
  scouting: 'Scouting',
  matched: 'Matched',
  chatting: 'Chatting',
  quiet: 'Gone Quiet',
  ghosted: 'Ghosted',
  date_planned: 'Date Planned',
  dating: 'Dating',
  ended: 'Ended',
  archived: 'Archived',
}

/* token name per status — drives text/border colour classes */
export const STATUS_COLOR: Record<Status, string> = {
  scouting: 'salmon',
  matched: 'lavender',
  chatting: 'teal',
  quiet: 'amber',
  ghosted: 'mauve',
  date_planned: 'rose',
  dating: 'rose',
  ended: 'mauve',
  archived: 'faint',
}

export const APPS = ['hinge', 'mattr', 'bumble', 'other'] as const
