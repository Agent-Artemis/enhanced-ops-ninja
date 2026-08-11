import { getCrmClient } from './client';
import type {
  Contact, Note, Stage, TeamMember, Sequence, VoiceAgent,
  Activity, ActivityKind, ActivityPlatform, MeetingOutcome,
  ActionItem,
} from './types';
import { pendingBookingOf, stackOf, stackMemberIds, appointmentOf, appointmentMovedToDate } from './types';

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
  // Blank form fields arrive as '' — coerce to SQL NULL so Postgres doesn't reject
  // them (e.g. next_action_date '' → "invalid input syntax for type date"). This is
  // what lets a dateless card save from the Action Needed section.
  const payload: Record<string, unknown> = { ...contact };
  for (const k of ['next_action_date', 'date_entered', 'stage_id', 'assigned_to', 'sequence_id', 'voice_agent_id']) {
    if (payload[k] === '') payload[k] = null;
  }
  const { data, error } = await (await sb())
    .from('crm_contacts')
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Contact;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await (await sb()).from('crm_contacts').delete().eq('id', id);
  if (error) throw error;
}

// ── Activities (outreach + meetings) ────────────────────────────────────────────
export async function logActivity(a: {
  kind: ActivityKind;
  platform: ActivityPlatform;
  contact_id?: string | null;
  direction?: 'outbound' | 'inbound';
  outcome?: MeetingOutcome | null;
  occurred_at?: string;
  body?: string | null;
}): Promise<Activity> {
  const { data, error } = await (await sb())
    .from('crm_activities')
    .insert({
      kind: a.kind,
      platform: a.platform,
      contact_id: a.contact_id ?? null,
      direction: a.direction ?? 'outbound',
      outcome: a.outcome ?? null,
      occurred_at: a.occurred_at ?? new Date().toISOString(),
      body: a.body ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Activity;
}

export async function fetchActivitiesForContact(contactId: string): Promise<Activity[]> {
  const { data, error } = await (await sb())
    .from('crm_activities')
    .select('*')
    .eq('contact_id', contactId)
    .order('occurred_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Activity[];
}

// ── Meeting action items (crm_action_items) ───────────────────────────────────
// Single source of truth. The Action Items tab and the contact card both read
// and write these same rows — nothing is ever copied between them.

/** Every action item, newest meeting first, insertion order within a meeting. */
export async function fetchActionItems(): Promise<ActionItem[]> {
  const { data, error } = await (await sb())
    .from('crm_action_items')
    .select('*')
    .order('meeting_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ActionItem[];
}

/**
 * Items to render on one contact card: open AND done, so completed items stay on
 * the card as a struck-through historical record. Skipped items are excluded — a
 * skip means "won't do", not a record worth keeping in front of the client.
 * Ordered open-first (status desc: 'open' > 'done'), then by creation for a
 * stable order within each group.
 */
export async function fetchCardActionItemsForContact(contactId: string): Promise<ActionItem[]> {
  const { data, error } = await (await sb())
    .from('crm_action_items')
    .select('*')
    .eq('contact_id', contactId)
    .in('status', ['open', 'done'])
    .order('status', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ActionItem[];
}

async function updateActionItem(id: string, patch: Partial<ActionItem>): Promise<ActionItem> {
  const { data, error } = await (await sb())
    .from('crm_action_items')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as ActionItem;
}

/**
 * Tick / untick an action item. Ticking stamps `completed_at`; unticking reverts
 * to 'open' and clears it. Called from BOTH the Action Items tab and the contact
 * card — same row, so it's done in both places at once.
 */
export async function setActionItemDone(id: string, done: boolean): Promise<ActionItem> {
  return updateActionItem(id, {
    status: done ? 'done' : 'open',
    completed_at: done ? new Date().toISOString() : null,
  });
}

/** Skip an item, optionally recording why. */
export async function skipActionItem(id: string, reason: string | null): Promise<ActionItem> {
  return updateActionItem(id, {
    status: 'skipped',
    skip_reason: reason && reason.trim() ? reason.trim() : null,
    completed_at: null,
  });
}

/** Assign to a team member id, the literal 'artemis', or null to clear. */
export async function assignActionItem(id: string, assignee: string | null): Promise<ActionItem> {
  return updateActionItem(id, { assigned_to: assignee });
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

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await (await sb()).from('crm_notes').delete().eq('id', noteId);
  if (error) throw error;
}

export async function updateNote(noteId: string, body: string): Promise<Note> {
  const { data, error } = await (await sb())
    .from('crm_notes')
    .update({ body })
    .eq('id', noteId)
    .select()
    .single();
  if (error) throw error;
  return data as Note;
}

/**
 * File a card under `date`, and take its scheduled appointment with it.
 *
 * The appointment's `start_time` is an absolute instant stamped on the OLD day,
 * while ContactCard only renders the time while the appointment's date matches
 * `next_action_date` — so without this the time would silently stop showing
 * ("the scheduled time goes away") even though the data was still there.
 *
 * The appointment is re-stamped onto the new date at the SAME Denver wall-clock
 * time-of-day (2:00 PM stays 2:00 PM, DST crossings included). Cards with no
 * appointment are updated exactly as before — `custom_fields` is never written.
 *
 * This is the path used by drag-to-day, the snooze buttons (+1d / +1wk) and
 * stack moves, so the time follows the card in all of them.
 */
export async function fileUnderDate(contactId: string, date: string): Promise<void> {
  const client = await sb();

  // Fetch-modify-write: the browser client can't do a server-side jsonb_set, so
  // read the current custom_fields and rewrite the whole object (spread, so no
  // sibling key — linkedin, stack, lead_source … — is dropped).
  const { data: existing, error: readError } = await client
    .from('crm_contacts')
    .select('custom_fields')
    .eq('id', contactId)
    .single();
  if (readError) throw readError;

  const customFields = (existing?.custom_fields ?? null) as Record<string, unknown> | null;
  const appt = customFields ? appointmentOf({ custom_fields: customFields }) : null;

  const patch: Record<string, unknown> = { next_action_date: date, is_active: true, bucket: 'active' };
  if (appt && customFields) {
    patch.custom_fields = { ...customFields, appointment: appointmentMovedToDate(appt, date) };
  }

  const { error } = await client.from('crm_contacts').update(patch).eq('id', contactId);
  if (error) throw error;
}

/**
 * Drop the scheduled appointment from a card, leaving every other custom field
 * intact. After this `appointmentOf()` returns null, so no time badge renders.
 * Returns the new custom_fields so the caller can keep local state in sync.
 */
export async function clearAppointment(contactId: string): Promise<Record<string, unknown>> {
  const client = await sb();

  const { data: existing, error: readError } = await client
    .from('crm_contacts')
    .select('custom_fields')
    .eq('id', contactId)
    .single();
  if (readError) throw readError;

  const customFields = { ...((existing?.custom_fields ?? {}) as Record<string, unknown>) };
  delete customFields.appointment;

  const { error } = await client
    .from('crm_contacts')
    .update({ custom_fields: customFields })
    .eq('id', contactId);
  if (error) throw error;
  return customFields;
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

/**
 * Add or remove one partner tag on a contact, leaving every other tag intact.
 *
 * Partner status is plain membership in `tags` (see PARTNER_BADGES), and it is
 * INDEPENDENT of the pipeline — this deliberately touches nothing but `tags`, so
 * a card keeps its bucket, is_active and next_action_date. Dropping a card onto
 * Referral Partners must not pull it out of wherever it already lives.
 *
 * Fetch-modify-write, same reason as fileUnderDate: the browser client can't do
 * a server-side array append, so read the current tags and rewrite the whole
 * array rather than clobbering it.
 */
export async function setPartnerTag(contactId: string, tag: string, on: boolean): Promise<void> {
  const client = await sb();

  const { data: existing, error: readError } = await client
    .from('crm_contacts')
    .select('tags')
    .eq('id', contactId)
    .single();
  if (readError) throw readError;

  const current: string[] = Array.isArray(existing?.tags) ? (existing!.tags as string[]) : [];
  const has = current.includes(tag);
  if (has === on) return; // already in the wanted state — no write

  const next = on ? [...current, tag] : current.filter(t => t !== tag);

  const { error } = await client.from('crm_contacts').update({ tags: next }).eq('id', contactId);
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

// ── Card stacking (custom_fields.stack) ──────────────────────────────────────
// A stack co-locates several cards under one "primary": members inherit the
// primary's next_action_date / is_active / bucket so they move together and the
// list hides members (they render as offset peeks under the primary).

/**
 * File `memberIds` under the stack whose primary is `primaryId`.
 * - Reuses the primary's existing stack id or mints a new one.
 * - Each member gets custom_fields.stack = { id, role:'member', order } and is
 *   co-located with the primary (next_action_date / is_active / bucket copied).
 * - If a member was itself a primary of another stack, ALL of that stack's
 *   members are re-parented into this stack (dragging a stack onto a card merges).
 * - Read-modify-write preserves every other custom_fields key.
 */
export async function stackCards(primaryId: string, memberIds: string[]): Promise<void> {
  const client = await sb();
  const { data: all, error: fetchErr } = await client.from('crm_contacts').select('*');
  if (fetchErr) throw fetchErr;
  const contacts = (all ?? []) as Contact[];
  const byId = new Map(contacts.map(c => [c.id, c]));

  const primary = byId.get(primaryId);
  if (!primary) return;

  const existing = stackOf(primary);
  const stackId = existing?.id ?? crypto.randomUUID();

  // Next order = one past the current highest member order (or 1 for a new stack).
  const currentMembers = stackMemberIds(primary, contacts).map(id => byId.get(id)!).filter(Boolean);
  let nextOrder = currentMembers.reduce((m, c) => Math.max(m, stackOf(c)!.order), 0) + 1;

  type Update = {
    id: string;
    custom_fields: Record<string, unknown>;
    next_action_date?: string | null;
    is_active?: boolean;
    bucket?: Contact['bucket'];
  };
  const updates: Update[] = [];

  // Establish the primary if it wasn't already a stack primary.
  if (!existing) {
    updates.push({
      id: primary.id,
      custom_fields: { ...(primary.custom_fields ?? {}), stack: { id: stackId, role: 'primary', order: 0 } },
    });
  }

  // Expand each requested member; if it was a primary elsewhere, pull its members too.
  const toAdd: string[] = [];
  for (const mid of memberIds) {
    if (mid === primaryId) continue;
    const m = byId.get(mid);
    if (!m) continue;
    const ms = stackOf(m);
    if (ms?.id === stackId) continue; // already in this stack
    toAdd.push(mid);
    if (ms?.role === 'primary') {
      for (const sub of stackMemberIds(m, contacts)) {
        if (sub !== primaryId && stackOf(byId.get(sub)!)?.id !== stackId) toAdd.push(sub);
      }
    }
  }

  for (const mid of [...new Set(toAdd)]) {
    const m = byId.get(mid)!;
    updates.push({
      id: mid,
      custom_fields: { ...(m.custom_fields ?? {}), stack: { id: stackId, role: 'member', order: nextOrder++ } },
      next_action_date: primary.next_action_date ?? null,
      is_active: primary.is_active,
      bucket: primary.bucket,
    });
  }

  for (const u of updates) {
    const { id, ...fields } = u;
    const { error } = await client.from('crm_contacts').update(fields).eq('id', id);
    if (error) throw error;
  }
}

/**
 * Remove one card from its stack. The card keeps its current next_action_date
 * (it stays where the stack was). If removing it leaves the primary with zero
 * members, the primary's stack key is also removed (no lone 1-card stacks).
 * Read-modify-write preserves every other custom_fields key.
 */
export async function unstackCard(cardId: string): Promise<void> {
  const client = await sb();
  const { data: all, error: fetchErr } = await client.from('crm_contacts').select('*');
  if (fetchErr) throw fetchErr;
  const contacts = (all ?? []) as Contact[];
  const byId = new Map(contacts.map(c => [c.id, c]));

  const card = byId.get(cardId);
  if (!card) return;
  const cs = stackOf(card);
  if (!cs) return; // not in a stack — nothing to do

  // Drop the stack key from this card.
  const cf = { ...(card.custom_fields ?? {}) };
  delete cf['stack'];
  const { error: e1 } = await client.from('crm_contacts').update({ custom_fields: cf }).eq('id', cardId);
  if (e1) throw e1;

  // If the stack's primary now has no members left, dissolve it too.
  const primary = contacts.find(c => {
    const s = stackOf(c);
    return s?.id === cs.id && s.role === 'primary';
  });
  if (!primary || primary.id === cardId) return;

  const remaining = contacts.filter(c => {
    if (c.id === cardId) return false;
    const s = stackOf(c);
    return s?.id === cs.id && s.role === 'member';
  });
  if (remaining.length === 0) {
    const pcf = { ...(primary.custom_fields ?? {}) };
    delete pcf['stack'];
    const { error: e2 } = await client.from('crm_contacts').update({ custom_fields: pcf }).eq('id', primary.id);
    if (e2) throw e2;
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

/** Star/unstar a LinkedIn lead (custom_fields.linkedin.starred). */
export async function setLeadStarred(contact: Contact, starred: boolean): Promise<void> {
  const cf = { ...(contact.custom_fields ?? {}) };
  const li = cf['linkedin'];
  if (!li || typeof li !== 'object') return;
  cf['linkedin'] = { ...(li as Record<string, unknown>), starred };
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

/**
 * Mark the post-acceptance meeting invite as sent for an accepted lead.
 * Stamps custom_fields.linkedin.meeting_invite_sent_at = now (ISO), which removes
 * the lead from the Meeting Invite queue. Spreads custom_fields and the linkedin
 * object so no other key is lost, and touches ONLY meeting_invite_sent_at.
 */
export async function markMeetingInviteSent(contact: Contact): Promise<void> {
  const cf = { ...(contact.custom_fields ?? {}) };
  const li = { ...(cf['linkedin'] as Record<string, unknown> ?? {}) };
  li['meeting_invite_sent_at'] = new Date().toISOString();
  cf['linkedin'] = li;
  const { error } = await (await sb())
    .from('crm_contacts')
    .update({ custom_fields: cf })
    .eq('id', contact.id);
  if (error) throw error;
}

/**
 * Mark an inbound reply as handled for a matched lead.
 * Stamps custom_fields.linkedin.replied_handled_at = now (ISO), which removes the
 * lead from the "⚡ Replies — respond first" priority block. Spreads custom_fields
 * and the linkedin object so no other key is lost, and touches ONLY replied_handled_at.
 */
export async function markReplyHandled(contact: Contact): Promise<void> {
  const cf = { ...(contact.custom_fields ?? {}) };
  const li = { ...(cf['linkedin'] as Record<string, unknown> ?? {}) };
  li['replied_handled_at'] = new Date().toISOString();
  cf['linkedin'] = li;
  const { error } = await (await sb())
    .from('crm_contacts')
    .update({ custom_fields: cf })
    .eq('id', contact.id);
  if (error) throw error;
}

/**
 * Skip the post-acceptance meeting invite for an accepted lead.
 * Stamps custom_fields.linkedin.meeting_invite_skipped_at = now (ISO), which
 * removes the lead from the Meeting Invite queue without recording it as sent.
 * Spreads custom_fields and the linkedin object so no other key is lost.
 */
export async function skipMeetingInvite(contact: Contact): Promise<void> {
  const cf = { ...(contact.custom_fields ?? {}) };
  const li = { ...(cf['linkedin'] as Record<string, unknown> ?? {}) };
  li['meeting_invite_skipped_at'] = new Date().toISOString();
  cf['linkedin'] = li;
  const { error } = await (await sb())
    .from('crm_contacts')
    .update({ custom_fields: cf })
    .eq('id', contact.id);
  if (error) throw error;
}

/**
 * Skip a sequence step WITHOUT recording it as sent.
 * Stamps {step}_skipped_at (durable audit marker) and advances the cadence
 * exactly like advanceLinkedIn so the lead leaves today's list — but does NOT
 * set {step}_sent_at and does NOT touch the funnel status.
 */
export async function skipLinkedIn(
  contact: Contact,
  step: 'msg1' | 'msg2' | 'msg3',
): Promise<void> {
  const cf = { ...(contact.custom_fields ?? {}) };
  const li = { ...(cf['linkedin'] as Record<string, unknown> ?? {}) };
  const now = new Date().toISOString();

  // Record it as SKIPPED, not sent — do NOT set {step}_sent_at.
  li[`${step}_skipped_at`] = now;

  // Advance the cadence exactly like advanceLinkedIn so it leaves today's list.
  const nextStep = step === 'msg1' ? 'msg2' : step === 'msg2' ? 'msg3' : 'done';
  li['sequence_step'] = nextStep;
  if (nextStep === 'msg2' || nextStep === 'msg3') {
    const days = nextStep === 'msg2' ? 3 : 4;
    const due = new Date();
    due.setDate(due.getDate() + days);
    li['sequence_due'] = due.toISOString().slice(0, 10);
  }

  cf['linkedin'] = li;
  const { error } = await (await sb())
    .from('crm_contacts')
    .update({ custom_fields: cf })
    .eq('id', contact.id);
  if (error) throw error;
}
