import { getCrmClient } from './client';
import type { Contact, Note, Stage, TeamMember, Sequence, VoiceAgent } from './types';

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

export async function fetchAffiliateContacts(): Promise<{ id: string; first_name: string; last_name?: string; company?: string }[]> {
  try {
    const { data } = await (await sb())
      .from('crm_contacts')
      .select('id, first_name, last_name, company')
      .contains('tags', ['affiliate'])
      .eq('is_active', true)
      .order('last_name', { ascending: true, nullsFirst: false });
    return (data ?? []) as { id: string; first_name: string; last_name?: string; company?: string }[];
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
