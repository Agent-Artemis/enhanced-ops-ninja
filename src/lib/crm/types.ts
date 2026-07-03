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
