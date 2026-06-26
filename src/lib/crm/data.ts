import { crmSupabase } from './client';
import type { Contact, Note, Stage, TeamMember, Sequence, VoiceAgent } from './types';

export async function fetchContacts(): Promise<Contact[]> {
  const { data, error } = await crmSupabase
    .from('crm_contacts')
    .select('*, notes:crm_notes(*)')
    .order('next_action_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as Contact[];
}

export async function upsertContact(contact: Partial<Contact> & { id?: string }): Promise<Contact> {
  const { data, error } = await crmSupabase
    .from('crm_contacts')
    .upsert(contact)
    .select()
    .single();
  if (error) throw error;
  return data as Contact;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await crmSupabase.from('crm_contacts').delete().eq('id', id);
  if (error) throw error;
}

export async function addNote(contactId: string, body: string): Promise<Note> {
  const { data, error } = await crmSupabase
    .from('crm_notes')
    .insert({ contact_id: contactId, body })
    .select()
    .single();
  if (error) throw error;
  return data as Note;
}

/** Move a contact to a specific date bucket */
export async function fileUnderDate(contactId: string, date: string): Promise<void> {
  const { error } = await crmSupabase
    .from('crm_contacts')
    .update({ next_action_date: date, is_active: true, bucket: 'active' })
    .eq('id', contactId);
  if (error) throw error;
}

export async function pullToActive(contactId: string): Promise<void> {
  const { error } = await crmSupabase
    .from('crm_contacts')
    .update({ bucket: 'active', is_active: true, next_action_date: null })
    .eq('id', contactId);
  if (error) throw error;
}

export async function sendToAlpha(contactId: string): Promise<void> {
  const { error } = await crmSupabase
    .from('crm_contacts')
    .update({ is_active: false, bucket: 'alpha' })
    .eq('id', contactId);
  if (error) throw error;
}

export async function fetchStages(): Promise<Stage[]> {
  const { data, error } = await crmSupabase
    .from('crm_stages')
    .select('*')
    .order('position');
  if (error) throw error;
  return data as Stage[];
}

export async function fetchTeam(): Promise<TeamMember[]> {
  const { data, error } = await crmSupabase
    .from('crm_team_members')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as TeamMember[];
}

export async function fetchSequences(): Promise<Sequence[]> {
  const { data, error } = await crmSupabase
    .from('crm_sequences')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as Sequence[];
}

export async function fetchVoiceAgents(): Promise<VoiceAgent[]> {
  const { data, error } = await crmSupabase
    .from('crm_voice_agents')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as VoiceAgent[];
}

export async function upsertVoiceAgent(agent: Partial<VoiceAgent> & { id?: string }): Promise<VoiceAgent> {
  const { data, error } = await crmSupabase
    .from('crm_voice_agents')
    .upsert(agent)
    .select()
    .single();
  if (error) throw error;
  return data as VoiceAgent;
}

export async function deleteVoiceAgent(id: string): Promise<void> {
  const { error } = await crmSupabase.from('crm_voice_agents').delete().eq('id', id);
  if (error) throw error;
}
