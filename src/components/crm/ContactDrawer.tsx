'use client';

import { useEffect, useState } from 'react';
import type { Contact, Stage, TeamMember, Sequence, Note } from '@/lib/crm/types';
import { appointmentOf } from '@/lib/crm/types';
import { upsertContact, deleteContact, addNote, deleteNote, updateNote, fetchAffiliateContacts } from '@/lib/crm/data';
import { QuickLogActivity } from './QuickLogActivity';

interface Props {
  open: boolean;
  contact: Contact | null;
  stages: Stage[];
  team: TeamMember[];
  sequences: Sequence[];
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY: Partial<Contact> = {
  first_name: '', last_name: '', company: '', email: '', phone: '',
  stage_id: undefined, assigned_to: undefined, sequence_id: undefined,
  next_action_date: '', is_active: true,
};

// Dark theme tokens (matching dojo)
const D = {
  drawer:   '#1A1A1A',
  header:   '#111111',
  body:     '#1A1A1A',
  footer:   '#111111',
  border:   '#2d2d2d',
  input:    '#0f1117',
  inputBorder: '#374151',
  text:     '#FFFFFF',
  textSec:  '#9ca3af',
  textMut:  '#6b7280',
  label:    '#9ca3af',
  blue:     '#1A6BF9',
  noteBg:   '#111111',
  red:      '#EF4444',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  background: D.input, border: `1px solid ${D.inputBorder}`,
  borderRadius: 8, fontSize: 14, color: D.text, outline: 'none',
  boxSizing: 'border-box', appearance: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: D.label, marginBottom: 5,
  letterSpacing: '0.04em', textTransform: 'uppercase',
};

// Auto-format a US phone number on blur: (XXX) XXX-XXXX, or +1 (XXX) XXX-XXXX.
// Leaves partial or international numbers as typed so nothing gets mangled.
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw;
}

// Convert a wall-clock date + time in America/Denver to an ISO timestamp,
// independent of the browser's own timezone (the app displays times in Denver).
function denverWallClockToISO(dateStr: string, timeStr: string): string {
  const [Y, M, D] = dateStr.split('-').map(Number);
  const [h, m] = timeStr.split(':').map(Number);
  const guessUTC = Date.UTC(Y, M - 1, D, h, m);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Denver', hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(guessUTC)).map(p => [p.type, p.value]),
  );
  const asIfUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offsetMs = asIfUTC - guessUTC; // how far Denver is ahead of UTC (negative)
  return new Date(guessUTC - offsetMs).toISOString();
}

export function ContactDrawer({ open, contact, stages, team, sequences, onClose, onSaved }: Props) {
  const [form, setForm]         = useState<Partial<Contact>>(EMPTY);
  const [notes, setNotes]       = useState<Note[]>([]);
  const [newNote, setNewNote]   = useState('');
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editBody, setEditBody]       = useState('');
  const [savingEdit, setSavingEdit]   = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState('');
  const [logOpen, setLogOpen]   = useState(false);

  // Lead source fields (stored in custom_fields)
  const [leadSource, setLeadSource]   = useState('');
  const [referredBy, setReferredBy]   = useState('');
  const [affiliateId, setAffiliateId] = useState('');
  // Scheduled appointment time (HH:MM, business timezone) — stored in custom_fields.appointment
  const [apptTime, setApptTime]       = useState('');
  const [affiliates, setAffiliates]   = useState<{ id: string; name: string; code: string; contact_name?: string }[]>([]);

  useEffect(() => {
    if (open) {
      if (contact) {
        const { notes: n, ...rest } = contact;
        setForm(rest);
        setNotes(n ?? []);
        const cf = contact.custom_fields ?? {};
        setLeadSource((cf.lead_source as string) ?? '');
        setReferredBy((cf.referred_by as string) ?? '');
        setAffiliateId((cf.affiliate_id as string) ?? '');
        const appt = appointmentOf(contact);
        setApptTime(
          appt
            ? new Date(appt.start_time).toLocaleTimeString('en-GB', {
                timeZone: 'America/Denver', hour: '2-digit', minute: '2-digit',
              })
            : '',
        );
      } else {
        setForm(EMPTY);
        setNotes([]);
        setLeadSource('');
        setReferredBy('');
        setAffiliateId('');
        setApptTime('');
      }
      setNewNote('');
      setError('');
      // Load affiliates (contacts tagged 'affiliate')
      fetchAffiliateContacts().then(setAffiliates).catch(() => setAffiliates([]));
    }
  }, [open, contact]);

  function set(key: keyof Contact, value: unknown) {
    setForm(p => ({ ...p, [key]: value }));
  }

  async function save() {
    if (!form.first_name?.trim()) { setError('First name required'); return; }
    setSaving(true); setError('');
    const customFields: Record<string, unknown> = { ...(form.custom_fields ?? {}) };
    if (leadSource) customFields.lead_source = leadSource;
    if (leadSource === 'referral' && referredBy) customFields.referred_by = referredBy;
    if (leadSource === 'affiliate' && affiliateId) customFields.affiliate_id = affiliateId;
    // Scheduled appointment time (only meaningful with a date). Timed cards sort to the top of their day.
    if (form.next_action_date && apptTime) {
      const existing = (customFields.appointment ?? {}) as Record<string, unknown>;
      customFields.appointment = {
        ...existing,
        start_time: denverWallClockToISO(form.next_action_date, apptTime),
        event_title: (existing.event_title as string) || 'Scheduled',
      };
    } else {
      delete customFields.appointment;
    }
    try {
      const saved = await upsertContact({ ...form, custom_fields: customFields });
      // First note on a brand-new card: the composer holds it in `newNote` until
      // the card exists, then we attach it. Best-effort — a note failure shouldn't
      // block card creation.
      if (!contact && newNote.trim()) {
        try { await addNote(saved.id, newNote.trim()); } catch { /* note is best-effort */ }
      }
      onSaved();
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!contact?.id) return;
    if (!confirm('Delete this contact?')) return;
    setDeleting(true);
    try { await deleteContact(contact.id); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setDeleting(false); }
  }

  async function submitNote() {
    if (!contact?.id || !newNote.trim()) return;
    const note = await addNote(contact.id, newNote.trim());
    setNotes(p => [note, ...p]);
    setNewNote('');
  }

  async function removeNote(id: string) {
    if (deletingNoteId) return;
    if (!confirm('Delete this note?')) return;
    setDeletingNoteId(id);
    try {
      await deleteNote(id);
      setNotes(p => p.filter(x => x.id !== id));
      if (editingId === id) { setEditingId(null); setEditBody(''); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setDeletingNoteId(null); }
  }

  function startEdit(n: Note) {
    setEditingId(n.id);
    setEditBody(n.body);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditBody('');
  }

  async function saveEdit(id: string) {
    const body = editBody.trim();
    if (!body || savingEdit) return;
    setSavingEdit(true);
    try {
      const updated = await updateNote(id, body);
      setNotes(p => p.map(x => x.id === id ? updated : x));
      setEditingId(null);
      setEditBody('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Update failed'); }
    finally { setSavingEdit(false); }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }}
      />

      {/* Drawer */}
      <aside style={{
        position: 'fixed', right: 0, top: 0, bottom: 0,
        width: '100%', maxWidth: 520,
        background: D.drawer, zIndex: 50,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.6)',
        fontFamily: 'system-ui, sans-serif',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px',
          background: D.header, borderBottom: `1px solid ${D.border}`,
          flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: D.text }}>
            {contact ? `${contact.first_name} ${contact.last_name ?? ''}` : 'New Contact'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: D.textMut, fontSize: 22, lineHeight: 1, padding: 4,
            }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {error && (
            <div style={{
              fontSize: 13, color: D.red, background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              padding: '8px 12px', borderRadius: 6, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {/* Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input type="text" value={form.first_name ?? ''} onChange={e => set('first_name', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input type="text" value={form.last_name ?? ''} onChange={e => set('last_name', e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Company */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Company</label>
            <input type="text" value={form.company ?? ''} onChange={e => set('company', e.target.value)} style={inputStyle} />
          </div>

          {/* Phone / Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Phone</label>
              <input type="tel" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)}
                onBlur={e => set('phone', formatPhone(e.target.value))} placeholder="(555) 123-4567" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Stage */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Stage</label>
            <select value={form.stage_id ?? ''} onChange={e => set('stage_id', e.target.value || undefined)}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">— No stage —</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Lead Source */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Lead Source</label>
            <select
              value={leadSource}
              onChange={e => { setLeadSource(e.target.value); setReferredBy(''); setAffiliateId(''); }}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">— None —</option>
              <option value="referral">Referral</option>
              <option value="affiliate">Affiliate</option>
            </select>
          </div>

          {leadSource === 'referral' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Referred By</label>
              <input
                type="text"
                value={referredBy}
                onChange={e => setReferredBy(e.target.value)}
                placeholder="Name of the person who referred"
                style={inputStyle}
              />
            </div>
          )}

          {leadSource === 'affiliate' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Affiliate</label>
              <select
                value={affiliateId}
                onChange={e => setAffiliateId(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">— Select affiliate —</option>
                {affiliates.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.contact_name ? ` — ${a.contact_name}` : ''}
                  </option>
                ))}
              </select>
              {affiliates.length === 0 && (
                <p style={{ margin: '4px 0 0', fontSize: 11, color: D.textMut }}>
                  No active affiliates found. Add one in the Dojo → Affiliates.
                </p>
              )}
            </div>
          )}

          {/* Assigned / Sequence */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Assigned To</label>
              <select value={form.assigned_to ?? ''} onChange={e => set('assigned_to', e.target.value || undefined)}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">— Unassigned —</option>
                {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Sequence</label>
              <select value={form.sequence_id ?? ''} onChange={e => set('sequence_id', e.target.value || undefined)}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">— None —</option>
                {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Next Action Date + Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 6 }}>
            <div>
              <label style={labelStyle}>Next Action Date</label>
              <input type="date" value={form.next_action_date ?? ''} onChange={e => set('next_action_date', e.target.value || undefined)}
                style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            <div>
              <label style={labelStyle}>Appointment Time</label>
              <input type="time" value={apptTime} onChange={e => setApptTime(e.target.value)}
                disabled={!form.next_action_date}
                style={{ ...inputStyle, colorScheme: 'dark', opacity: form.next_action_date ? 1 : 0.5,
                  cursor: form.next_action_date ? 'text' : 'not-allowed' }} />
            </div>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 11, color: D.textMut }}>
            Add a time for scheduled appointments — timed cards rise to the top of that day.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <input type="checkbox" id="is_active" checked={form.is_active ?? true} onChange={e => set('is_active', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: D.blue, cursor: 'pointer' }} />
            <label htmlFor="is_active" style={{ fontSize: 14, color: D.textSec, cursor: 'pointer' }}>Active</label>
          </div>

          {/* Activity — log outreach / meetings against this card */}
          {contact && (
            <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 16, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: D.textMut,
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                Activity
              </div>
              <button
                onClick={() => setLogOpen(true)}
                style={{
                  padding: '6px 12px', background: 'transparent', color: D.blue,
                  border: `1px solid ${D.blue}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                + Log outreach / meeting
              </button>
            </div>
          )}

          {/* Notes */}
          <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 16 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: D.textMut,
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12,
            }}>
              Notes
            </div>

            {contact ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <textarea
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Add a note…"
                    rows={2}
                    style={{
                      flex: 1, ...inputStyle, resize: 'none',
                      padding: '8px 12px', fontSize: 13,
                    }}
                  />
                  <button
                    onClick={submitNote}
                    disabled={!newNote.trim()}
                    style={{
                      padding: '0 16px', background: D.blue, color: '#fff',
                      border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: newNote.trim() ? 'pointer' : 'not-allowed',
                      opacity: newNote.trim() ? 1 : 0.4,
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {notes.length === 0 && (
                    <p style={{ fontSize: 12, color: D.textMut, fontStyle: 'italic', margin: 0 }}>No notes yet.</p>
                  )}
                  {notes.map(n => (
                    <div key={n.id} style={{
                      background: D.noteBg, borderRadius: 8, padding: '8px 12px',
                      border: `1px solid ${D.border}`,
                    }}>
                      {editingId === n.id ? (
                        <>
                          <textarea
                            value={editBody}
                            onChange={e => setEditBody(e.target.value)}
                            rows={2}
                            style={{
                              width: '100%', ...inputStyle, resize: 'vertical',
                              padding: '6px 8px', fontSize: 13,
                            }}
                          />
                          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                            <button
                              onClick={() => saveEdit(n.id)}
                              disabled={!editBody.trim() || savingEdit}
                              style={{
                                background: 'none', border: 'none', padding: 0,
                                fontSize: 11, color: D.blue,
                                cursor: editBody.trim() && !savingEdit ? 'pointer' : 'not-allowed',
                                opacity: editBody.trim() ? 1 : 0.4,
                              }}
                            >
                              {savingEdit ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              style={{
                                background: 'none', border: 'none', padding: 0,
                                fontSize: 11, color: D.textMut, cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p style={{ margin: 0, fontSize: 13, color: D.text }}>{n.body}</p>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                            <p style={{ margin: 0, fontSize: 11, color: D.textMut }}>
                              {new Date(n.created_at).toLocaleString()}
                            </p>
                            <div style={{ display: 'flex', gap: 10 }}>
                              <button
                                onClick={() => startEdit(n)}
                                style={{
                                  background: 'none', border: 'none', padding: 0,
                                  fontSize: 11, color: D.textMut, cursor: 'pointer',
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => removeNote(n.id)}
                                disabled={deletingNoteId === n.id}
                                style={{
                                  background: 'none', border: 'none', padding: 0,
                                  fontSize: 11, color: D.textMut,
                                  cursor: deletingNoteId === n.id ? 'not-allowed' : 'pointer',
                                  opacity: deletingNoteId === n.id ? 0.4 : 1,
                                }}
                              >
                                {deletingNoteId === n.id ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              // New card: no id yet, so hold the first note in state and persist it
              // right after the card is created (see save()).
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a note — saved when you create the card…"
                rows={3}
                style={{
                  width: '100%', ...inputStyle, resize: 'vertical',
                  padding: '8px 12px', fontSize: 13,
                }}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          background: D.footer, borderTop: `1px solid ${D.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexShrink: 0,
        }}>
          {contact ? (
            <button
              onClick={handleDelete} disabled={deleting}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: D.red, opacity: deleting ? 0.4 : 1,
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          ) : <span />}

          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 18px', fontSize: 13,
                background: 'transparent', color: D.textSec,
                border: `1px solid ${D.inputBorder}`, borderRadius: 8, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={save} disabled={saving}
              style={{
                padding: '8px 18px', fontSize: 13, fontWeight: 600,
                background: D.blue, color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : (contact ? 'Save' : 'Create')}
            </button>
          </div>
        </div>
      </aside>

      {logOpen && contact && (
        <QuickLogActivity
          contactId={contact.id}
          contactLabel={`${contact.first_name} ${contact.last_name ?? ''}`.trim()}
          onClose={() => setLogOpen(false)}
        />
      )}
    </>
  );
}
