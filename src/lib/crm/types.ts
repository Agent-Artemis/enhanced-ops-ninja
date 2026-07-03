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
