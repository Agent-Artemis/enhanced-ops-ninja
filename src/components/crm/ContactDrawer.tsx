'use client';

import { useEffect, useState } from 'react';
import type { Contact, Stage, TeamMember, Sequence, VoiceAgent, Note } from '@/lib/crm/types';
import { upsertContact, deleteContact, addNote } from '@/lib/crm/data';

interface Props {
  open: boolean;
  contact: Contact | null;
  stages: Stage[];
  team: TeamMember[];
  sequences: Sequence[];
  agents: VoiceAgent[];
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY: Partial<Contact> = {
  first_name: '', last_name: '', company: '', email: '', phone: '',
  stage_id: undefined, assigned_to: undefined, sequence_id: undefined,
  voice_agent_id: undefined, next_action_date: '', is_active: true,
};

export function ContactDrawer({ open, contact, stages, team, sequences, agents, onClose, onSaved }: Props) {
  const [form, setForm]       = useState<Partial<Contact>>(EMPTY);
  const [notes, setNotes]     = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (open) {
      if (contact) {
        const { notes: n, ...rest } = contact;
        setForm(rest);
        setNotes(n ?? []);
      } else {
        setForm(EMPTY);
        setNotes([]);
      }
      setNewNote('');
      setError('');
    }
  }, [open, contact]);

  function set(key: keyof Contact, value: unknown) {
    setForm(p => ({ ...p, [key]: value }));
  }

  async function save() {
    if (!form.first_name?.trim()) { setError('First name required'); return; }
    setSaving(true);
    setError('');
    try {
      await upsertContact(form);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!contact?.id) return;
    if (!confirm('Delete this contact?')) return;
    setDeleting(true);
    try {
      await deleteContact(contact.id);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  async function submitNote() {
    if (!contact?.id || !newNote.trim()) return;
    const note = await addNote(contact.id, newNote.trim());
    setNotes(p => [...p, note]);
    setNewNote('');
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">
            {contact ? `${contact.first_name} ${contact.last_name ?? ''}` : 'New Contact'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
              <input type="text" value={form.first_name ?? ''} onChange={e => set('first_name', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Last Name</label>
              <input type="text" value={form.last_name ?? ''} onChange={e => set('last_name', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]" />
            </div>
          </div>

          {/* Company */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Company</label>
            <input type="text" value={form.company ?? ''} onChange={e => set('company', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]" />
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input type="tel" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]" />
            </div>
          </div>

          {/* Stage */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Stage</label>
            <select value={form.stage_id ?? ''} onChange={e => set('stage_id', e.target.value || undefined)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]">
              <option value="">— No stage —</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Assigned / Sequence / Voice Agent */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Assigned To</label>
              <select value={form.assigned_to ?? ''} onChange={e => set('assigned_to', e.target.value || undefined)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]">
                <option value="">— Unassigned —</option>
                {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sequence</label>
              <select value={form.sequence_id ?? ''} onChange={e => set('sequence_id', e.target.value || undefined)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]">
                <option value="">— None —</option>
                {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">AI Voice Agent</label>
            <select value={form.voice_agent_id ?? ''} onChange={e => set('voice_agent_id', e.target.value || undefined)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]">
              <option value="">— None —</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* Next action date */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Next Action Date</label>
              <input type="date" value={form.next_action_date ?? ''} onChange={e => set('next_action_date', e.target.value || undefined)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]" />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <input type="checkbox" id="is_active" checked={form.is_active ?? true} onChange={e => set('is_active', e.target.checked)}
                className="w-4 h-4 accent-[#1A6ECC]" />
              <label htmlFor="is_active" className="text-sm text-slate-600">Active</label>
            </div>
          </div>

          {/* Notes */}
          {contact && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Notes</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                {notes.length === 0 && <p className="text-xs text-slate-400">No notes yet.</p>}
                {notes.map(n => (
                  <div key={n.id} className="bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-sm text-slate-700">{n.body}</p>
                    <p className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Add a note…"
                  rows={2}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]"
                />
                <button onClick={submitNote} disabled={!newNote.trim()}
                  className="px-3 py-2 bg-[#1A6ECC] text-white text-sm rounded-lg disabled:opacity-40 hover:bg-[#155fb3] transition-colors">
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 shrink-0 flex items-center justify-between gap-3">
          {contact && (
            <button onClick={handleDelete} disabled={deleting}
              className="text-sm text-red-600 hover:text-red-800 disabled:opacity-40">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 text-sm bg-[#1A6ECC] text-white rounded-lg hover:bg-[#155fb3] disabled:opacity-40 transition-colors">
              {saving ? 'Saving…' : (contact ? 'Save' : 'Create')}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
