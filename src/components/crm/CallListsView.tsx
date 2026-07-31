'use client';

import { useCallback, useEffect, useState } from 'react';
import { getCrmClient } from '@/lib/crm/client';

/* ─── Dark palette (matches the CRM shell) ──────────────────────────────────── */
const C = {
  pageBg: '#111111',
  cardBg: '#1A1A1A',
  border: '#2d2d2d',
  blue: '#1A6BF9',
  blue2: '#3F8AE0',
  text: '#FFFFFF',
  textSec: '#9ca3af',
  green: '#22c55e',
  amber: '#F5B301',
  red: '#EF4444',
};

/*
 * A growing set of prospecting lists. The AI Call List (top) is a LIVE, DB-backed
 * queue worked by Jason (our Retell outbound AI agent). Below it are the hand-dial
 * hosted lists (tap-to-call static pages).
 */
interface CallList {
  id: string;
  title: string;
  blurb: string;
  count: string;
  url: string;
}

const LISTS: CallList[] = [
  {
    id: 'ut-snf-al',
    title: 'Utah — SNF & AL Administrators',
    blurb:
      '224 assisted-living administrators (name + phone) plus 97 skilled-nursing facilities. ' +
      'Tap a number to dial. On each person: OCS adds them to your Action Needed, 📝 logs a note, 🗑 removes them.',
    count: '321 contacts',
    url: 'https://enhancedops.ninja/lists/ut-snf-al.html',
  },
];

/* ─── AI Call List (Jason) ──────────────────────────────────────────────────── */
interface QueueLead {
  id: number;
  lead_id: number;
  business_name: string | null;
  phone_e164: string | null;
  category: string | null;
  city: string | null;
  county: string | null;
  status: string;
  queued_at: string;
  last_call_at: string | null;
  last_outcome: string | null;
}

interface QueueResponse {
  queued: QueueLead[];
  counts: Record<string, number>;
  dialing_enabled: boolean;
}

async function sessionToken(): Promise<string | null> {
  const { data } = await getCrmClient().auth.getSession();
  return data.session?.access_token ?? null;
}

function pill(label: string, value: number | string, color: string) {
  return (
    <span
      key={label}
      style={{
        fontSize: 12,
        fontWeight: 700,
        color,
        background: `${color}1f`,
        border: `1px solid ${color}55`,
        borderRadius: 999,
        padding: '3px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      {value} {label}
    </span>
  );
}

function AiCallList() {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const token = await sessionToken();
      const res = await fetch('/api/crm/call-queue', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        setErr(`Couldn't load the AI call queue (${res.status}).`);
        setData(null);
        return;
      }
      setData((await res.json()) as QueueResponse);
    } catch {
      setErr("Couldn't load the AI call queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: number, action: string) {
    setBusy(id);
    setFlash(null);
    try {
      const token = await sessionToken();
      const res = await fetch('/api/crm/call-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id, action }),
      });
      const json = (await res.json().catch(() => ({}))) as { gated?: boolean; message?: string };
      if (action === 'dial' && json.gated) {
        setFlash(json.message ?? 'Dialing is gated off.');
        return; // leave the lead on the list
      }
      await load(); // refresh after no/booked/remove/called
    } finally {
      setBusy(null);
    }
  }

  const dialingOn = data?.dialing_enabled ?? false;

  return (
    <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: C.text }}>🤖 AI Call List — Jason</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: dialingOn ? C.green : C.amber,
              background: dialingOn ? 'rgba(34,197,94,0.12)' : 'rgba(245,179,1,0.12)',
              border: `1px solid ${dialingOn ? 'rgba(34,197,94,0.4)' : 'rgba(245,179,1,0.4)'}`,
              borderRadius: 6,
              padding: '2px 8px',
            }}
          >
            {dialingOn ? 'Dialing ON' : 'Dialing GATED OFF'}
          </span>
        </div>
        <button
          onClick={() => void load()}
          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textSec, borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Refresh
        </button>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5, color: C.textSec }}>
        AI-callable business landlines, topped up to a daily target. Jason dials from here; a booking moves them into
        OCS, and a “No” snoozes them for a few months. Auto-dialing stays off until Jeff turns it on.
      </p>

      {data && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {pill('queued', data.counts.queued ?? 0, C.blue)}
          {pill('called', data.counts.called ?? 0, C.blue2)}
          {pill('snoozed', data.counts.snoozed ?? 0, C.amber)}
          {pill('booked', data.counts.booked ?? 0, C.green)}
        </div>
      )}

      {flash && (
        <div style={{ fontSize: 12, color: C.amber, background: 'rgba(245,179,1,0.08)', border: '1px solid rgba(245,179,1,0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
          {flash}
        </div>
      )}

      {loading && <div style={{ fontSize: 13, color: C.textSec }}>Loading…</div>}
      {err && <div style={{ fontSize: 13, color: C.red }}>{err}</div>}

      {!loading && !err && data && data.queued.length === 0 && (
        <div style={{ fontSize: 13, color: C.textSec, fontStyle: 'italic' }}>
          No leads queued yet. The daily loader tops this up with AI-callable landlines as the tagging job flags them.
        </div>
      )}

      {!loading && !err && data && data.queued.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.queued.map((lead) => (
            <div
              key={lead.id}
              style={{
                background: '#141414',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text, minWidth: 160 }}>
                {lead.business_name ?? 'Unknown business'}
              </span>
              <span style={{ fontSize: 12, color: C.textSec, flex: 1, minWidth: 120 }}>
                {[lead.category, [lead.city, lead.county].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
              </span>

              {lead.phone_e164 && (
                <a
                  href={`tel:${lead.phone_e164}`}
                  style={{ fontSize: 13, fontWeight: 600, color: C.blue2, textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  📞 {lead.phone_e164}
                </a>
              )}

              <button
                onClick={() => act(lead.id, 'dial')}
                disabled={busy === lead.id}
                title={dialingOn ? 'Dial with Jason' : 'Dialing is gated off — enable JASON_DIALING_ENABLED'}
                style={{
                  fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 6, whiteSpace: 'nowrap',
                  background: dialingOn ? C.blue : 'transparent',
                  color: dialingOn ? '#fff' : C.textSec,
                  border: dialingOn ? 'none' : `1px solid ${C.border}`,
                  cursor: busy === lead.id ? 'default' : 'pointer', opacity: busy === lead.id ? 0.5 : 1,
                }}
              >
                {dialingOn ? '📲 Dial (Jason)' : '📲 Dial (off)'}
              </button>

              <button
                onClick={() => act(lead.id, 'booked')}
                disabled={busy === lead.id}
                style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6, background: 'transparent', color: C.green, border: '1px solid rgba(34,197,94,0.35)', cursor: 'pointer' }}
              >
                Booked
              </button>
              <button
                onClick={() => act(lead.id, 'no')}
                disabled={busy === lead.id}
                title="Prospect said no — snooze ~4 months, then auto re-queue"
                style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6, background: 'transparent', color: C.amber, border: '1px solid rgba(245,179,1,0.35)', cursor: 'pointer' }}
              >
                No / Snooze
              </button>
              <button
                onClick={() => act(lead.id, 'remove')}
                disabled={busy === lead.id}
                style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6, background: 'transparent', color: C.red, border: 'none', cursor: 'pointer' }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── One (hosted) list card ────────────────────────────────────────────────── */
function ListCard({ list }: { list: CallList }) {
  return (
    <div
      style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <a
            href={list.url}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: C.blue2,
              textDecoration: 'none',
              borderBottom: '1px solid rgba(63,138,224,0.4)',
              paddingBottom: 1,
            }}
          >
            {list.title}
          </a>
          <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5, color: C.textSec }}>{list.blurb}</p>
        </div>
        <span
          style={{
            flexShrink: 0,
            fontSize: 12,
            fontWeight: 700,
            color: C.blue,
            background: 'rgba(26,107,249,0.12)',
            padding: '4px 10px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}
        >
          {list.count}
        </span>
      </div>

      <div>
        <a
          href={list.url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 40,
            padding: '0 18px',
            borderRadius: 8,
            background: C.blue,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Open list ↗
        </a>
      </div>
    </div>
  );
}

/* ─── View ──────────────────────────────────────────────────────────────────── */
export function CallListsView() {
  return (
    <div style={{ background: C.pageBg, minHeight: 'calc(100vh - 88px)', padding: '28px 20px 60px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text }}>Call Lists</h1>
          <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.5, color: C.textSec }}>
            Prospecting lists to work. The AI Call List is worked by Jason; the hosted lists are hand-dialed — open one
            to tap-to-call, log each person, and add the good ones to your pipeline with the{' '}
            <strong style={{ color: C.text }}>OCS</strong> button.
          </p>
        </div>

        <AiCallList />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {LISTS.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      </div>
    </div>
  );
}
