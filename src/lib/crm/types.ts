export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role?: string;
  created_at: string;
}

export interface VoiceAgent {
  id: string;
  name: string;
  persona?: string;
  voice?: string;
  call_instructions?: string;
  text_instructions?: string;
  email_instructions?: string;
  created_at: string;
  updated_at: string;
}

export interface Sequence {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Stage {
  id: string;
  name: string;
  position: number;
  color: string;
  created_at: string;
}

export interface Note {
  id: string;
  contact_id: string;
  author_id?: string;
  body: string;
  created_at: string;
}

export type Bucket = 'today' | 'active' | 'day' | 'month' | 'alpha';

export interface Contact {
  id: string;
  first_name: string;
  last_name?: string;
  company?: string;
  email?: string;
  phone?: string;
  stage_id?: string;
  assigned_to?: string;
  sequence_id?: string;
  voice_agent_id?: string;
  next_action_date?: string;
  date_entered?: string;
  is_active: boolean;
  bucket: Bucket;
  bucket_day?: number;
  bucket_month?: string;
  bucket_alpha?: string;
  tags?: string[];
  custom_fields?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // joined
  notes?: Note[];
}

export type CrmView = 'onecard' | 'kanban' | 'list' | 'actions' | 'social' | 'reports';

// ── Project / company color-coding (custom_fields.project) ─────────────────────
// A card can optionally be tagged with a project/company name + a muted color so
// Jeff can visually group cards that belong to a client build. No `project` key =
// default EON card (rendered exactly as before). Muted palette only — nothing bright.

export const PROJECT_COLORS = [
  { name: 'Slate Blue',  value: '#4A6FA5' },
  { name: 'Sage Green',  value: '#5B8A72' },
  { name: 'Terracotta',  value: '#C0824E' },
  { name: 'Slate Grey',  value: '#6B7280' },
  { name: 'Dusty Teal',  value: '#4E8079' },
  { name: 'Muted Plum',  value: '#7A6A9B' },
  { name: 'Warm Sand',   value: '#A3894F' },
] as const;

export interface ProjectTag {
  name: string;
  color: string;
}

/** Read + validate custom_fields.project. Needs both a non-empty name and a color. */
export function projectOf(c: Pick<Contact, 'custom_fields'>): ProjectTag | null {
  const p = c.custom_fields?.['project'];
  if (p && typeof p === 'object' && !Array.isArray(p)) {
    const r = p as Partial<ProjectTag>;
    if (typeof r.name === 'string' && r.name.trim() && typeof r.color === 'string' && r.color) {
      return { name: r.name, color: r.color };
    }
  }
  return null;
}

// ── Partner tags + job title ──────────────────────────────────────────────────
// Partner status is stored as plain membership in the existing `tags` array (no
// schema change). The two partner types are INDEPENDENT of each other, of the
// kanban stage, and of the `bucket` — a contact can sit in any pipeline stage,
// be a client, AND be a referral and/or affiliate partner all at once.
// Job title lives in custom_fields.title (a string).

export const REFERRAL_PARTNER_TAG  = 'Referral Partner';
export const AFFILIATE_PARTNER_TAG = 'Affiliate Partner';

/** The two partner toggles, with the muted card-face badge color for each. */
export const PARTNER_BADGES: { tag: string; label: string; color: string }[] = [
  { tag: REFERRAL_PARTNER_TAG,  label: 'Referral Partner',  color: '#4A6FA5' }, // slate blue
  { tag: AFFILIATE_PARTNER_TAG, label: 'Affiliate Partner', color: '#5B8A72' }, // sage green
];

/** Which partner badges to show for a contact, based on its `tags` membership. */
export function partnerBadgesOf(c: Pick<Contact, 'tags'>): { label: string; color: string }[] {
  const tags = c.tags ?? [];
  return PARTNER_BADGES.filter(b => tags.includes(b.tag)).map(({ label, color }) => ({ label, color }));
}

/** Read custom_fields.title (job title). Empty string when unset. */
export function titleOf(c: Pick<Contact, 'custom_fields'>): string {
  const t = c.custom_fields?.['title'];
  return typeof t === 'string' ? t : '';
}

// ── Meeting action items (extracted from Granola notes) ────────────────────────
// ONE row per action item — rendered in the Action Items tab AND on the matched
// contact's card (ContactDrawer). Never copied; both surfaces write the same row.

export type ActionItemStatus = 'open' | 'done' | 'skipped';
export type MatchConfidence = 'matched' | 'unmatched' | 'ambiguous';

/** The literal stored in `assigned_to` when an item is handed to Artemis. */
export const ARTEMIS_ASSIGNEE = 'artemis';

export interface ActionItem {
  id: string;
  source?: string | null;
  granola_note_id?: string | null;
  meeting_title: string;
  meeting_date?: string | null;      // timestamptz — render in browser tz
  attendees?: string[] | null;       // jsonb array of names
  contact_id?: string | null;
  match_confidence?: MatchConfidence | null;
  item_text: string;
  due_date?: string | null;          // date — YYYY-MM-DD, no time component
  status: ActionItemStatus;
  assigned_to?: string | null;       // crm_team_members.id, or ARTEMIS_ASSIGNEE
  skip_reason?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Stable identity for the meeting an item came from. Granola gives us a note id;
 * hand-entered rows fall back to title + date so they still group together.
 */
export function meetingKeyOf(a: ActionItem): string {
  return a.granola_note_id ?? `${a.meeting_title}|${a.meeting_date ?? ''}`;
}

// ── Activity tracking (outreach + meetings) — feeds the Reports dashboard ───────
export type ActivityKind = 'outreach' | 'meeting';

export type ActivityPlatform =
  | 'linkedin' | 'facebook' | 'instagram' | 'x'
  | 'phone' | 'text' | 'email' | 'referral' | 'in_person' | 'other';

export type MeetingOutcome =
  | 'booked' | 'held' | 'no_show' | 'rescheduled' | 'won' | 'lost' | 'follow_up';

export interface Activity {
  id: string;
  contact_id?: string | null;   // nullable — pre-card outreach isn't tied to a card
  kind: ActivityKind;
  platform: ActivityPlatform;
  direction: 'outbound' | 'inbound';
  outcome?: MeetingOutcome | null;
  occurred_at: string;
  body?: string | null;
  author_id?: string | null;
  created_at: string;
}

export const ACTIVITY_PLATFORMS: { id: ActivityPlatform; label: string }[] = [
  { id: 'linkedin',  label: 'LinkedIn' },
  { id: 'facebook',  label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'x',         label: 'X / Twitter' },
  { id: 'phone',     label: 'Phone Call' },
  { id: 'text',      label: 'Text / SMS' },
  { id: 'email',     label: 'Email' },
  { id: 'referral',  label: 'Referral' },
  { id: 'in_person', label: 'In Person' },
  { id: 'other',     label: 'Other' },
];

export const MEETING_OUTCOMES: { id: MeetingOutcome; label: string }[] = [
  { id: 'booked',      label: 'Booked' },
  { id: 'held',        label: 'Held' },
  { id: 'no_show',     label: 'No-show' },
  { id: 'rescheduled', label: 'Rescheduled' },
  { id: 'won',         label: 'Won' },
  { id: 'lost',        label: 'Lost' },
  { id: 'follow_up',   label: 'Follow-up' },
];

export function platformLabel(p: string): string {
  return ACTIVITY_PLATFORMS.find(x => x.id === p)?.label ?? p;
}

/** A Cal.com booking awaiting approve/ignore in the Bookings panel. */
export interface PendingBooking {
  event_title: string;
  start_time: string | null;
  date: string | null;        // YYYY-MM-DD in business timezone
  time_label: string;
  duplicate: boolean;         // true when the booker matched an existing card
  source?: string | null;     // 'linkedin-dm' when booked via the 30-min DM link
}

export function pendingBookingOf(c: Contact): PendingBooking | null {
  const pb = c.custom_fields?.['pending_booking'];
  return pb && typeof pb === 'object' && !Array.isArray(pb) ? (pb as PendingBooking) : null;
}

/** LinkedIn outreach prospect data (custom_fields.linkedin). */
export type LeadStatus = 'new' | 'invited' | 'messaged' | 'replied' | 'booked' | 'skipped';
export type SequenceStep = 'msg1' | 'msg2' | 'msg3' | 'done';

export interface LinkedInLead {
  profile_url: string;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  status: LeadStatus;
  added_at?: string;
  booked_at?: string;
  // Sequence fields — populated by Artemis per-lead, advanced by UI
  sequence_step?: SequenceStep;
  sequence_due?: string;   // YYYY-MM-DD — date this step should be sent
  msg1?: string;           // personalized connection request (<300 chars)
  msg2?: string;           // personalized value drop
  msg3?: string;           // personalized soft pitch + 30-min link
  msg2_asset?: string;     // optional suggested asset to mention with msg2
  msg3_asset?: string;     // optional suggested asset to mention with msg3
  accepted?: boolean;      // true when LinkedIn connection was accepted
  accepted_at?: string;    // ISO — when the connection was accepted
  parked?: boolean;        // lead is parked/paused — excluded from the meeting-invite queue
  starred?: boolean;       // Jeff flagged this lead as a strong option
  accepted_msg?: string;   // warm acceptance response: welcome + value drop + one-pager + 30-min link
  msg1_sent_at?: string;
  msg2_sent_at?: string;
  msg3_sent_at?: string;
  // Meeting-invite queue — surfaced once a connection is accepted, independent of the msg1/2/3 sequence
  meeting_invite_sent_at?: string;     // ISO — Jeff sent the meeting invite (removes from queue)
  meeting_invite_skipped_at?: string;  // ISO — Jeff skipped sending a meeting invite (removes from queue)
}

export function linkedinOf(c: Contact): LinkedInLead | null {
  const li = c.custom_fields?.['linkedin'];
  return li && typeof li === 'object' && !Array.isArray(li) && (li as LinkedInLead).profile_url
    ? (li as LinkedInLead) : null;
}

/** Card-stacking membership (custom_fields.stack). Standalone cards have no `stack` key. */
export interface CardStackRef {
  id: string;                     // uuid shared by every card in the group
  role: 'primary' | 'member';
  order: number;                  // 0 = primary, 1..n = members
}

export function stackOf(c: Contact): CardStackRef | null {
  const s = c.custom_fields?.['stack'];
  if (s && typeof s === 'object' && !Array.isArray(s)) {
    const r = s as Partial<CardStackRef>;
    if (typeof r.id === 'string' && (r.role === 'primary' || r.role === 'member') && typeof r.order === 'number') {
      return r as CardStackRef;
    }
  }
  return null;
}

/**
 * Member card ids of the stack whose primary is `primary`, sorted by order.
 * Returns [] when `primary` is not a stack primary. Members are found across
 * `all` by matching stack id + role==='member'.
 */
export function stackMemberIds(primary: Contact, all: Contact[]): string[] {
  const s = stackOf(primary);
  if (!s || s.role !== 'primary') return [];
  return all
    .filter(c => {
      const cs = stackOf(c);
      return cs?.id === s.id && cs.role === 'member';
    })
    .sort((a, b) => (stackOf(a)!.order) - (stackOf(b)!.order))
    .map(c => c.id);
}

/** A confirmed appointment attached to a card (set when a booking is approved). */
export interface Appointment {
  start_time: string;         // ISO
  event_title?: string;
}

/** The business timezone. All appointment wall-clock times are expressed in it. */
export const BUSINESS_TZ = 'America/Denver';

export function appointmentOf(c: Pick<Contact, 'custom_fields'>): Appointment | null {
  const a = c.custom_fields?.['appointment'];
  return a && typeof a === 'object' && !Array.isArray(a) && (a as Appointment).start_time
    ? (a as Appointment) : null;
}

/** "9:00 AM" in the business timezone. */
export function appointmentTimeLabel(a: Appointment): string {
  const d = new Date(a.start_time);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: BUSINESS_TZ });
}

/** YYYY-MM-DD of the appointment in the business timezone (to match next_action_date). */
export function appointmentDateString(a: Appointment): string {
  const d = new Date(a.start_time);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

// ── Business-timezone wall-clock conversion ────────────────────────────────────
// The stored `start_time` is an absolute instant (ISO/UTC), but users think in
// Denver wall-clock time. These two functions are exact inverses of each other
// and resolve the UTC offset from the instant itself, so they stay correct
// across DST boundaries (MDT −06:00 in summer, MST −07:00 in winter).

/**
 * Convert a wall-clock date + time in the business timezone to an ISO timestamp,
 * independent of the runtime's own timezone.
 * `denverWallClockToISO('2026-07-15', '14:00')` → the instant that is 2:00 PM in Denver.
 */
export function denverWallClockToISO(dateStr: string, timeStr: string): string {
  const [Y, M, D] = dateStr.split('-').map(Number);
  const [h, m] = timeStr.split(':').map(Number);
  const guessUTC = Date.UTC(Y, M - 1, D, h, m);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: BUSINESS_TZ, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(guessUTC)).map(p => [p.type, p.value]),
  );
  const asIfUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offsetMs = asIfUTC - guessUTC; // how far Denver is ahead of UTC (negative)
  return new Date(guessUTC - offsetMs).toISOString();
}

/**
 * The wall-clock time-of-day ("HH:MM", 24h) of an ISO instant in the business
 * timezone — the inverse of `denverWallClockToISO`. Returns '' for a bad timestamp.
 */
export function denverTimeOfDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: BUSINESS_TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit',
    }).formatToParts(d).map(p => [p.type, p.value]),
  );
  return `${parts.hour}:${parts.minute}`;
}

/**
 * The same appointment moved onto `date` (YYYY-MM-DD), keeping its Denver
 * wall-clock time-of-day. A 2:00 PM appointment stays 2:00 PM on the new day
 * even when the move crosses a DST boundary. Every other key is preserved.
 * Returns the appointment untouched if its `start_time` can't be read.
 */
export function appointmentMovedToDate(a: Appointment, date: string): Appointment {
  const timeOfDay = denverTimeOfDay(a.start_time);
  if (!timeOfDay) return a;
  return { ...a, start_time: denverWallClockToISO(date, timeOfDay) };
}
