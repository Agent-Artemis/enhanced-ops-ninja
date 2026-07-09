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

export type CrmView = 'onecard' | 'kanban' | 'list' | 'social' | 'reports';

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
  starred?: boolean;       // Jeff flagged this lead as a strong option
  accepted_msg?: string;   // warm acceptance response: welcome + value drop + one-pager + 30-min link
  msg1_sent_at?: string;
  msg2_sent_at?: string;
  msg3_sent_at?: string;
}

export function linkedinOf(c: Contact): LinkedInLead | null {
  const li = c.custom_fields?.['linkedin'];
  return li && typeof li === 'object' && !Array.isArray(li) && (li as LinkedInLead).profile_url
    ? (li as LinkedInLead) : null;
}

/** A confirmed appointment attached to a card (set when a booking is approved). */
export interface Appointment {
  start_time: string;         // ISO
  event_title?: string;
}

export function appointmentOf(c: Contact): Appointment | null {
  const a = c.custom_fields?.['appointment'];
  return a && typeof a === 'object' && !Array.isArray(a) && (a as Appointment).start_time
    ? (a as Appointment) : null;
}

/** "9:00 AM" in the business timezone. */
export function appointmentTimeLabel(a: Appointment): string {
  const d = new Date(a.start_time);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Denver' });
}

/** YYYY-MM-DD of the appointment in the business timezone (to match next_action_date). */
export function appointmentDateString(a: Appointment): string {
  const d = new Date(a.start_time);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}
