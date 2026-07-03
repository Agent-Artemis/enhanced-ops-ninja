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

export type CrmView = 'onecard' | 'kanban' | 'list' | 'social';

/** A Cal.com booking awaiting approve/ignore in the Bookings panel. */
export interface PendingBooking {
  event_title: string;
  start_time: string | null;
  date: string | null;        // YYYY-MM-DD in business timezone
  time_label: string;
  duplicate: boolean;         // true when the booker matched an existing card
}

export function pendingBookingOf(c: Contact): PendingBooking | null {
  const pb = c.custom_fields?.['pending_booking'];
  return pb && typeof pb === 'object' && !Array.isArray(pb) ? (pb as PendingBooking) : null;
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
