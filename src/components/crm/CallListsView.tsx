'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  {
    id: 'ut-operator-execs',
    title: 'Utah/MW — SNF & AL Operator Executives',
    blurb:
      'The C-suite (CEO/COO/CMO/owners) of the operators BEHIND the facilities — 82 executives ' +
      'across 21 operators, sorted by portfolio size. 44 on the SNF side, 38 on the AL side. ' +
      'Numbers are corporate main lines: ask for the executive by name. Same controls — OCS adds ' +
      'them to your Action Needed, 📝 logs a note, 🗑 removes them.',
    count: '82 executives',
    url: 'https://enhancedops.ninja/lists/ut-operator-execs.html',
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

/* ─── National Call List (DB-driven: SNF ∪ AL) ──────────────────────────────── */
interface FacilityRow {
  id: string;
  facility_source: 'snf' | 'al';
  facility_type: 'SNF' | 'AL';
  name: string | null;
  phone: string | null;
  administrator: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  beds: number | null;
  note: string | null;
  outcome: string | null;
  note_updated_at: string | null;
}
interface StateFacet {
  facility_source: 'snf' | 'al';
  facility_type: 'SNF' | 'AL';
  state: string;
  total: number;
  with_phone: number;
}
interface FacilityResponse {
  rows: FacilityRow[];
  total: number;
  page: number;
  limit: number;
  facets: { states: StateFacet[] };
}

const OUTCOMES: { id: string; label: string; color: string }[] = [
  { id: 'called', label: 'Called', color: C.blue2 },
  { id: 'booked', label: 'Booked', color: C.green },
  { id: 'no_answer', label: 'No answer', color: C.amber },
  { id: 'follow_up', label: 'Follow-up', color: C.blue },
];

function fmtPhone(p: string | null): string {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return p;
}

function FacilityCard({ row, onSaved }: { row: FacilityRow; onSaved: () => void }) {
  const [note, setNote] = useState(row.note ?? '');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(row.outcome ? `Last: ${row.outcome}` : null);

  async function post(payload: { note?: string; outcome?: string }) {
    setBusy(true);
    try {
      const token = await sessionToken();
      const res = await fetch('/api/crm/facility-call-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ facility_source: row.facility_source, facility_id: row.id, ...payload }),
      });
      if (!res.ok) {
        setFlash("Couldn't save — try again.");
        return;
      }
      setFlash(payload.outcome ? `Logged: ${payload.outcome.replace('_', ' ')}` : 'Note saved ✓');
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  const addr = [row.address, [row.city, row.state].filter(Boolean).join(', '), row.zip].filter(Boolean).join(' · ');

  return (
    <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{row.name ?? 'Unknown facility'}</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: row.facility_type === 'SNF' ? C.blue2 : C.amber, background: row.facility_type === 'SNF' ? 'rgba(63,138,224,0.15)' : 'rgba(245,179,1,0.15)', border: `1px solid ${row.facility_type === 'SNF' ? 'rgba(63,138,224,0.4)' : 'rgba(245,179,1,0.4)'}`, borderRadius: 5, padding: '1px 6px' }}>{row.facility_type}</span>
            {row.beds ? (
              <span style={{ fontSize: 10, fontWeight: 700, color: C.textSec, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>🛏 {row.beds} beds</span>
            ) : null}
          </div>
          {row.administrator && (
            <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600, marginTop: 3 }}>👤 {row.administrator}</div>
          )}
          {addr && <div style={{ fontSize: 12, color: C.textSec, marginTop: 3 }}>{addr}</div>}
        </div>
        {row.phone ? (
          <a href={`tel:${row.phone.replace(/\D/g, '')}`} style={{ fontSize: 15, fontWeight: 700, color: C.green, textDecoration: 'none', whiteSpace: 'nowrap', border: `1px solid rgba(34,197,94,0.4)`, borderRadius: 8, padding: '8px 12px' }}>
            📞 {fmtPhone(row.phone)}
          </a>
        ) : (
          <span style={{ fontSize: 12, color: C.textSec, fontStyle: 'italic' }}>no phone</span>
        )}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notes from the call…"
        rows={2}
        style={{ width: '100%', boxSizing: 'border-box', background: '#0f0f0f', border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, padding: '8px 10px', resize: 'vertical', outline: 'none' }}
      />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => void post({ note })}
          disabled={busy}
          style={{ fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 7, background: C.blue, color: '#fff', border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}
        >
          Save note
        </button>
        {OUTCOMES.map((o) => (
          <button
            key={o.id}
            onClick={() => void post({ note, outcome: o.id })}
            disabled={busy}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 7, background: 'transparent', color: o.color, border: `1px solid ${o.color}55`, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}
          >
            {o.label}
          </button>
        ))}
        {flash && <span style={{ fontSize: 11, color: C.textSec, marginLeft: 4 }}>{flash}</span>}
      </div>
    </div>
  );
}

const US_STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DC: 'D.C.', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii',
  IA: 'Iowa', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', MA: 'Massachusetts', MD: 'Maryland', ME: 'Maine', MI: 'Michigan',
  MN: 'Minnesota', MO: 'Missouri', MS: 'Mississippi', MT: 'Montana', NC: 'North Carolina',
  ND: 'North Dakota', NE: 'Nebraska', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
  NV: 'Nevada', NY: 'New York', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
  UT: 'Utah', VA: 'Virginia', VT: 'Vermont', WA: 'Washington', WI: 'Wisconsin', WV: 'West Virginia',
  WY: 'Wyoming',
};

function NationalCallList() {
  const [type, setType] = useState<'all' | 'snf' | 'al'>('all');
  const [state, setState] = useState('all');
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<FacilityResponse | null>(null);
  const [rows, setRows] = useState<FacilityRow[]>([]);
  const [facets, setFacets] = useState<StateFacet[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false); // collapsed by default; hydrated from localStorage below
  const LIMIT = 50;

  // Restore the open/closed choice (default collapsed when unset)
  useEffect(() => {
    try {
      setOpen(localStorage.getItem('ocs_national_calllist_open') === '1');
    } catch {
      /* ignore */
    }
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem('ocs_national_calllist_open', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [type, state, qDebounced]);

  const load = useCallback(async (p: number, replace: boolean) => {
    setLoading(true);
    setErr(null);
    try {
      const token = await sessionToken();
      const params = new URLSearchParams({ type, state, q: qDebounced, page: String(p), limit: String(LIMIT) });
      const res = await fetch(`/api/crm/facility-call-list?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        setErr(`Couldn't load the national call list (${res.status}).`);
        return;
      }
      const json = (await res.json()) as FacilityResponse;
      setData(json);
      if (json.facets?.states?.length) setFacets(json.facets.states);
      setRows((prev) => (replace ? json.rows : [...prev, ...json.rows]));
    } catch {
      setErr("Couldn't load the national call list.");
    } finally {
      setLoading(false);
    }
  }, [type, state, qDebounced]);

  useEffect(() => { void load(page, page === 1); }, [page, load]);

  // Available states for the dropdown, filtered by the SNF/AL toggle.
  const stateOptions = useMemo(() => {
    const map = new Map<string, { total: number; withPhone: number }>();
    for (const f of facets) {
      if (type !== 'all' && f.facility_source !== type) continue;
      const cur = map.get(f.state) ?? { total: 0, withPhone: 0 };
      cur.total += f.total;
      cur.withPhone += f.with_phone;
      map.set(f.state, cur);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [facets, type]);

  const totalStates = stateOptions.length;

  return (
    <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
      {/* Collapsible header — click to expand/collapse. Default collapsed keeps the Jason queue + Utah card in view. */}
      <button
        onClick={toggleOpen}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          width: '100%', background: 'transparent', border: 'none', padding: 0,
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 14, color: C.textSec, width: 12, display: 'inline-block', flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: C.text }}>🇺🇸 National Call List — SNF &amp; AL</span>
        {data && (
          <span style={{ fontSize: 12, fontWeight: 700, color: C.blue, background: 'rgba(26,107,249,0.12)', border: '1px solid rgba(26,107,249,0.35)', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>
            {data.total.toLocaleString()}
          </span>
        )}
        <span style={{ fontSize: 12, color: C.textSec }}>{open ? '· click to collapse' : '· click to expand'}</span>
      </button>

      {open && (
      <div style={{ marginTop: 14 }}>
      <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.5, color: C.textSec }}>
        Every skilled-nursing &amp; assisted-living facility we&apos;ve loaded, nationwide. Pick a state, tap a number to
        dial, jot a note, and log the outcome — each logged call flows straight into your Reports.
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {/* SNF/AL toggle */}
        <div style={{ display: 'flex', gap: 3, background: '#0f0f0f', border: `1px solid ${C.border}`, borderRadius: 8, padding: 3 }}>
          {(['all', 'snf', 'al'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{ padding: '7px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: type === t ? C.blue : 'transparent', color: type === t ? '#fff' : C.textSec, textTransform: t === 'all' ? 'none' : 'uppercase' }}
            >
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>

        {/* State dropdown */}
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          style={{ background: '#0f0f0f', border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontWeight: 600, padding: '8px 12px', outline: 'none', cursor: 'pointer', minWidth: 150 }}
        >
          <option value="all">All states ({totalStates})</option>
          {stateOptions.map(([st, c]) => (
            <option key={st} value={st}>
              {US_STATE_NAMES[st] ?? st} — {c.withPhone.toLocaleString()} w/ phone
            </option>
          ))}
        </select>

        {/* Search */}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or city…"
          style={{ flex: '1 1 180px', minWidth: 140, background: '#0f0f0f', border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, padding: '8px 12px', outline: 'none' }}
        />
      </div>

      {/* Live counts */}
      {data && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {pill('facilities', data.total.toLocaleString(), C.blue)}
          {pill(state === 'all' ? 'states' : 'state', state === 'all' ? totalStates : state, C.blue2)}
        </div>
      )}

      {err && <div style={{ fontSize: 13, color: C.red, marginBottom: 8 }}>{err}</div>}

      {/* Results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => (
          <FacilityCard key={`${r.facility_source}:${r.id}`} row={r} onSaved={() => { /* fire-and-forget; local flash handles UX */ }} />
        ))}
      </div>

      {!loading && rows.length === 0 && !err && (
        <div style={{ fontSize: 13, color: C.textSec, fontStyle: 'italic' }}>No facilities match these filters.</div>
      )}
      {loading && <div style={{ fontSize: 13, color: C.textSec, marginTop: 10 }}>Loading…</div>}

      {/* Load more */}
      {data && rows.length < data.total && (
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={loading}
          style={{ marginTop: 12, alignSelf: 'flex-start', background: 'transparent', border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer' }}
        >
          Load more ({(data.total - rows.length).toLocaleString()} left)
        </button>
      )}
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

        <NationalCallList />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {LISTS.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      </div>
    </div>
  );
}
