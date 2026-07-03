'use client';

import { useState } from 'react';
import type { Contact } from '@/lib/crm/types';
import { pendingBookingOf } from '@/lib/crm/types';
import { approveBooking, ignoreBooking, deleteContact, sendTestBooking } from '@/lib/crm/data';

interface Props {
  contacts: Contact[];
  onClose: () => void;
  onRefresh: () => void;
}

const btn = (bg: string, color = '#fff'): React.CSSProperties => ({
  padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
  border: 'none', cursor: 'pointer', background: bg, color,
});

export function BookingsPanel({ contacts, onClose, onRefresh }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const pending = contacts.filter(c => pendingBookingOf(c));

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    try { await fn(); onRefresh(); } finally { setBusy(null); }
  }

  async function handleTest() {
    setBusy('test');
    setTestMsg(null);
    const r = await sendTestBooking();
    setTestMsg(r.ok ? 'Test booking sent — it will appear here in a few seconds.' : `Test failed: ${r.error}`);
    setBusy(null);
    if (r.ok) setTimeout(onRefresh, 2500);
  }

  return (
    <div style={{
      position: 'fixed', top: 92, right: 16, zIndex: 40, width: 420,
      maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
      background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.6)', padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
          Bookings — {pending.length} pending
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={btn('transparent', '#9ca3af')}>✕</button>
      </div>

      {pending.length === 0 && (
        <div style={{ fontSize: 13, color: '#6b7280', padding: '16px 0' }}>
          No bookings waiting for review.
        </div>
      )}

      {pending.map(c => {
        const pb = pendingBookingOf(c)!;
        const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim();
        return (
          <div key={c.id} style={{
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
            padding: '12px 14px', marginBottom: 10, background: 'rgba(255,255,255,0.03)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{name || c.email}</span>
              <span style={{
                background: pb.duplicate ? 'rgba(249,115,22,0.25)' : 'rgba(26,107,249,0.25)',
                color: pb.duplicate ? '#fb923c' : '#6B9CF9',
                borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700,
              }}>
                {pb.duplicate ? 'Existing card' : 'New'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 2 }}>{c.email}</div>
            <div style={{ fontSize: 13, color: '#d1d5db', marginBottom: 2 }}>{pb.event_title}</div>
            <div style={{ fontSize: 12, color: '#6B9CF9', fontWeight: 600, marginBottom: 10 }}>{pb.time_label}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={busy === c.id}
                onClick={() => run(c.id, () => approveBooking(c, pb.date))}
                style={btn('#1A6BF9')}
              >
                {pb.duplicate ? 'File on date' : 'Create card'}
              </button>
              <button
                disabled={busy === c.id}
                onClick={() => run(c.id, () => ignoreBooking(c))}
                style={btn('rgba(255,255,255,0.1)', '#d1d5db')}
              >
                Ignore
              </button>
              {!pb.duplicate && (
                <button
                  disabled={busy === c.id}
                  onClick={() => run(c.id, () => deleteContact(c.id))}
                  style={btn('rgba(239,68,68,0.2)', '#f87171')}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        );
      })}

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 12, paddingTop: 12 }}>
        <button disabled={busy === 'test'} onClick={handleTest} style={btn('rgba(26,107,249,0.2)', '#6B9CF9')}>
          {busy === 'test' ? 'Sending…' : '⚡ Send Test Booking'}
        </button>
        {testMsg && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>{testMsg}</div>}
      </div>
    </div>
  );
}
