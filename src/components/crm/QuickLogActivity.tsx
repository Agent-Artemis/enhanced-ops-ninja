'use client';

import { useState } from 'react';
import {
  ACTIVITY_PLATFORMS, MEETING_OUTCOMES,
  type ActivityKind, type ActivityPlatform, type MeetingOutcome,
} from '@/lib/crm/types';
import { logActivity } from '@/lib/crm/data';

interface Props {
  /** When set, the activity attaches to this card. Omit for pre-card outreach. */
  contactId?: string | null;
  contactLabel?: string;
  onClose: () => void;
  onLogged?: () => void;
}

const D = {
  drawer: '#1A1A1A', header: '#111111', border: '#2d2d2d',
  input: '#0f1117', inputBorder: '#374151',
  text: '#FFFFFF', textSec: '#9ca3af', textMut: '#6b7280', blue: '#1A6BF9', red: '#EF4444',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: D.input, border: `1px solid ${D.inputBorder}`,
  borderRadius: 8, fontSize: 14, color: D.text, outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: D.textSec, marginBottom: 5,
  letterSpacing: '0.04em', textTransform: 'uppercase',
};

export function QuickLogActivity({ contactId = null, contactLabel, onClose, onLogged }: Props) {
  const [kind, setKind] = useState<ActivityKind>('outreach');
  const [platform, setPlatform] = useState<ActivityPlatform>('linkedin');
  const [outcome, setOutcome] = useState<MeetingOutcome>('booked');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true); setError('');
    try {
      await logActivity({
        kind, platform, contact_id: contactId,
        outcome: kind === 'meeting' ? outcome : null,
        body: body.trim() || null,
      });
      onLogged?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to log activity');
      setSaving(false);
    }
  }

  const Toggle = ({ v, label }: { v: ActivityKind; label: string }) => (
    <button onClick={() => setKind(v)} style={{
      flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
      border: `1px solid ${kind === v ? D.blue : D.inputBorder}`,
      background: kind === v ? D.blue : 'transparent', color: kind === v ? '#fff' : D.textSec,
    }}>{label}</button>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '100%', maxWidth: 440, background: D.drawer, borderRadius: 14, zIndex: 70,
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)', fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 22px', background: D.header, borderBottom: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: D.text }}>Log Activity</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: D.textMut, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {contactLabel
            ? <div style={{ fontSize: 12, color: D.textMut }}>Attaching to <strong style={{ color: D.textSec }}>{contactLabel}</strong></div>
            : <div style={{ fontSize: 12, color: D.textMut }}>Not tied to a card — counts as pre-card outreach.</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <Toggle v="outreach" label="Outreach" />
            <Toggle v="meeting" label="Meeting" />
          </div>

          <div>
            <label style={labelStyle}>{kind === 'meeting' ? 'Source' : 'Platform'}</label>
            <select value={platform} onChange={e => setPlatform(e.target.value as ActivityPlatform)} style={{ ...inputStyle, cursor: 'pointer' }}>
              {ACTIVITY_PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>

          {kind === 'meeting' && (
            <div>
              <label style={labelStyle}>Outcome</label>
              <select value={outcome} onChange={e => setOutcome(e.target.value as MeetingOutcome)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {MEETING_OUTCOMES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>Note (optional)</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={2} placeholder="Context, not a card…"
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {error && <div style={{ fontSize: 13, color: D.red }}>{error}</div>}
        </div>

        <div style={{ padding: '14px 22px', background: D.header, borderTop: `1px solid ${D.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', fontSize: 13, background: 'transparent', color: D.textSec, border: `1px solid ${D.inputBorder}`, borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: D.blue, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Logging…' : 'Log'}
          </button>
        </div>
      </div>
    </>
  );
}
