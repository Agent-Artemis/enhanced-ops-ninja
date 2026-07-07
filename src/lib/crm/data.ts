import { getCrmClient } from './client';
import type { Contact, Note, Stage, TeamMember, Sequence, VoiceAgent } from './types';
import { pendingBookingOf } from './types';

// Await Supabase client initialization before making authenticated queries.
// The lazy client reads localStorage on init, but that init is async —
// awaiting getSession() guarantees the auth token is loaded.
async function sb() {
  const client = getCrmClient();
  await client.auth.getSession();
  return client;
}

export async function fetchContacts(): Promise<Contact[]> {
  const { data, error } = await (await sb())
    .from('crm_contacts')
    .select('*, notes:crm_notes(*)')
    .order('next_action_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as Contact[];
}

export async function upsertContact(contact: Partial<Contact> & { id?: string }): Promise<Contact> {
  const { data, error } = await (await sb())
    .from('crm_contacts')
    .upsert(contact)
    .select()
    .single();
  if (error) throw error;
  return data as Contact;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await (await sb()).from('crm_contacts').delete().eq('id', id);
  if (error) throw error;
}

export async function addNote(contactId: string, body: string): Promise<Note> {
  const { data, error } = await (await sb())
    .from('crm_notes')
    .insert({ contact_id: contactId, body })
    .select()
    .single();
  if (error) throw error;
  return data as Note;
}

export async function fileUnderDate(contactId: string, date: string): Promise<void> {
  const { error } = await (await sb())
    .from('crm_contacts')
    .update({ next_action_date: date, is_active: true, bucket: 'active' })
    .eq('id', contactId);
  if (error) throw error;
}

export async function pullToActive(contactId: string): Promise<void> {
  const { error } = await (await sb())
    .from('crm_contacts')
    .update({ bucket: 'active', is_active: true, next_action_date: null })
    .eq('id', contactId);
  if (error) throw error;
}

export async function sendToAlpha(contactId: string): Promise<void> {
  const { error } = await (await sb())
    .from('crm_contacts')
    .update({ is_active: false, bucket: 'alpha' })
    .eq('id', contactId);
  if (error) throw error;
}

export async function fetchAffiliateContacts(): Promise<{ id: string; name: string; code: string; contact_name?: string }[]> {
  try {
    const { data } = await (await sb())
      .from('affiliates')
      .select('id, name, code, contact_name')
      .eq('status', 'active')
      .order('name', { ascending: true });
    return (data ?? []) as { id: string; name: string; code: string; contact_name?: string }[];
  } catch { return []; }
}

export async function fetchStages(): Promise<Stage[]> {
  const { data, error } = await (await sb())
    .from('crm_stages')
    .select('*')
    .order('position');
  if (error) throw error;
  return data as Stage[];
}

export async function fetchTeam(): Promise<TeamMember[]> {
  const { data, error } = await (await sb())
    .from('crm_team_members')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as TeamMember[];
}

export async function fetchSequences(): Promise<Sequence[]> {
  const { data, error } = await (await sb())
    .from('crm_sequences')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as Sequence[];
}

export async function fetchVoiceAgents(): Promise<VoiceAgent[]> {
  const { data, error } = await (await sb())
    .from('crm_voice_agents')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as VoiceAgent[];
}

export async function upsertVoiceAgent(agent: Partial<VoiceAgent> & { id?: string }): Promise<VoiceAgent> {
  const { data, error } = await (await sb())
    .from('crm_voice_agents')
    .upsert(agent)
    .select()
    .single();
  if (error) throw error;
  return data as VoiceAgent;
}

export async function deleteVoiceAgent(id: string): Promise<void> {
  const { error } = await (await sb()).from('crm_voice_agents').delete().eq('id', id);
  if (error) throw error;
}

// ── Bookings review (Cal.com → pending_booking on custom_fields) ─────────────

function clearPendingBooking(contact: Contact): Record<string, unknown> {
  const cf = { ...(contact.custom_fields ?? {}) };
  delete cf['pending_booking'];
  return cf;
}

/**
 * Approve: file the card on the booking date, keep the appointment time on the
 * card (drives the time chip + chronological ordering), clear the pending entry.
 */
export async function approveBooking(contact: Contact, date: string | null): Promise<void> {
  const pb = pendingBookingOf(contact);
  const custom_fields = clearPendingBooking(contact);
  if (pb?.start_time) {
    custom_fields['appointment'] = { start_time: pb.start_time, event_title: pb.event_title };
  }
  const { error } = await (await sb())
    .from('crm_contacts')
    .update(date
      ? { next_action_date: date, is_active: true, bucket: 'active', custom_fields }
      : { is_active: true, bucket: 'active', next_action_date: null, custom_fields })
    .eq('id', contact.id);
  if (error) throw error;
}

/** Ignore: clear the pending entry; the card keeps its current placement. */
export async function ignoreBooking(contact: Contact): Promise<void> {
  const custom_fields = clearPendingBooking(contact);
  const { error } = await (await sb())
    .from('crm_contacts')
    .update({ custom_fields })
    .eq('id', contact.id);
  if (error) throw error;
}

/** Fire a fake Cal.com booking at the live webhook to test the full flow. */
export async function sendTestBooking(): Promise<{ ok: boolean; error?: string }> {
  const now = new Date();
  const start = new Date(now.getTime() + 24 * 60 * 60 * 1000); // tomorrow, same time
  const stamp = `${now.getHours()}${String(now.getMinutes()).padStart(2, '0')}`;
  try {
    const res = await fetch('/api/cal-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        triggerEvent: 'BOOKING_CREATED',
        payload: {
          title: 'TEST BOOKING — safe to ignore/delete',
          startTime: start.toISOString(),
          attendees: [{ email: `test-booking-${stamp}@enhancedops.ninja`, name: `Test Booking ${stamp}` }],
        },
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      return { ok: false, error: body?.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

/** Pull a LinkedIn lead's sequence_due to today so it appears in the current queue. */
export async function moveLinkedInToToday(contact: Contact): Promise<void> {
  const cf = { ...(contact.custom_fields ?? {}) };
  const li = { ...(cf['linkedin'] as Record<string, unknown> ?? {}) };
  li['sequence_due'] = new Date().toISOString().slice(0, 10);
  cf['linkedin'] = li;
  const { error } = await (await sb())
    .from('crm_contacts')
    .update({ custom_fields: cf })
    .eq('id', contact.id);
  if (error) throw error;
}

/** Update a LinkedIn lead's funnel status (custom_fields.linkedin.status). */
export async function setLeadStatus(contact: Contact, status: string): Promise<void> {
  const cf = { ...(contact.custom_fields ?? {}) };
  const li = cf['linkedin'];
  if (!li || typeof li !== 'object') return;
  cf['linkedin'] = { ...(li as Record<string, unknown>), status };
  const { error } = await (await sb())
    .from('crm_contacts')
    .update({ custom_fields: cf })
    .eq('id', contact.id);
  if (error) throw error;
}

/**
 * Mark a sequence step as sent and advance to the next step.
 * Sets {step}_sent_at, advances sequence_step, sets sequence_due for the next step,
 * and updates the funnel status to match.
 */
export async function advanceLinkedIn(
  contact: Contact,
  step: 'msg1' | 'msg2' | 'msg3',
): Promise<void> {
  const cf = { ...(contact.custom_fields ?? {}) };
  const li = { ...(cf['linkedin'] as Record<string, unknown> ?? {}) };

  const now = new Date().toISOString();
  li[`${step}_sent_at`] = now;

  // Advance step
  const nextStep = step === 'msg1' ? 'msg2' : step === 'msg2' ? 'msg3' : 'done';
  li['sequence_step'] = nextStep;

  // Set due date for next step
  if (nextStep === 'msg2' || nextStep === 'msg3') {
    const days = nextStep === 'msg2' ? 3 : 4;
    const due = new Date();
    due.setDate(due.getDate() + days);
    li['sequence_due'] = due.toISOString().slice(0, 10);
  }

  // Mirror to funnel status
  const statusMap: Record<string, string> = { msg1: 'invited', msg2: 'messaged' };
  if (statusMap[step]) li['status'] = statusMap[step];

  cf['linkedin'] = li;
  const { error } = await (await sb())
    .from('crm_contacts')
    .update({ custom_fields: cf })
    .eq('id', contact.id);
  if (error) throw error;
}
