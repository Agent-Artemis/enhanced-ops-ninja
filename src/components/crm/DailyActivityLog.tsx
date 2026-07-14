'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCrmClient } from '@/lib/crm/client';

// ── Dark styling tokens (mirrors ReportsView) ────────────────────────────────
const D = {
  bg: '#1A1A1A', card: '#1A1A1A', panel: '#111111', border: '#2d2d2d',
  text: '#FFFFFF', textSec: '#9ca3af', textMut: '#6b7280', faint: '#4b5563',
  blue: '#1A6BF9', green: '#16a34a', red: '#EF4444',
};

// ── Metric definitions: display label → db column (order = left→right) ────────
const METRICS = [
  { col: 'phone_calls', label: 'Phone Calls', abbr: 'Calls' },
  { col: 'texts', label: 'Text', abbr: 'Text' },
  { col: 'appts_made', label: 'APPTS Made', abbr: 'Made' },
  { col: 'appts_kept_initial', label: 'Initial', abbr: 'Initial' },
  { col: 'appts_kept_closing', label: 'Closing', abbr: 'Closing' },
  { col: 'closed', label: 'Closed', abbr: 'Closed' },
  { col: 'linkedin', label: 'LinkedIn', abbr: 'LinkedIn' },
  { col: 'instagram', label: 'Instagram', abbr: 'Insta' },
  { col: 'facebook', label: 'Facebook', abbr: 'FB' },
  { col: 'tiktok', label: 'TikTok', abbr: 'TikTok' },
  { col: 'x', label: 'X', abbr: 'X' },
] as const;

type MetricCol = (typeof METRICS)[number]['col'];
const METRIC_COLS = METRICS.map(m => m.col) as MetricCol[];

// The two "APPTS Kept" sub-columns, grouped under a bracketed KEPT header.
const KEPT_COLS: readonly MetricCol[] = ['appts_kept_initial', 'appts_kept_closing'];

// ── Tally strip: which columns get tap-to-count +/− buttons ──────────────────
// "Calls through Closed" only. Amount (money) and the social columns stay
// keyboard-entry — their tally cells render empty so the grid stays aligned.
const TALLY_COLS = [
  'phone_calls', 'texts', 'appts_made', 'appts_kept_initial', 'appts_kept_closing', 'closed',
] as const;
type TallyCol = (typeof TALLY_COLS)[number];
function isTallyCol(c: MetricCol): c is TallyCol {
  return (TALLY_COLS as readonly MetricCol[]).includes(c);
}

// Week starts MONDAY (ISO week). Flip this to 0 to make weeks start Sunday.
const WEEK_START_DOW = 1;

type DayRow = { activity_date: string; linkedin_auto?: boolean; amount?: number; amount_auto?: boolean } & Record<MetricCol, number>;
type RowMap = Record<string, DayRow>;
type Grouping = 'day' | 'week' | 'month';

/** Format a dollar amount for display, e.g. 8500 → "$8,500". */
function fmtUsd(n: number): string { return '$' + Math.round(n).toLocaleString(); }

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ── Date helpers (LOCAL timezone — never UTC) ────────────────────────────────
/** Format a Date as YYYY-MM-DD using the browser's LOCAL calendar day. */
function localDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string into a LOCAL midnight Date (avoids UTC shift). */
function parseLocalISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (x.getDay() - WEEK_START_DOW + 7) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

/** Descending list of local YYYY-MM-DD days across [from, to]. */
function daysDesc(from: string, to: string): string[] {
  const out: string[] = [];
  const start = parseLocalISO(from);
  for (const d = parseLocalISO(to); d >= start; d.setDate(d.getDate() - 1)) out.push(localDateISO(d));
  return out;
}

function zeroRow(date: string): DayRow {
  const r = { activity_date: date } as DayRow;
  for (const c of METRIC_COLS) r[c] = 0;
  return r;
}

// ── Range presets ────────────────────────────────────────────────────────────
type PresetId = 'week' | 'month' | 'quarter' | 'year' | 'custom';
const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'quarter', label: 'This Quarter' },
  { id: 'year', label: 'This Year' },
];

/** Returns {from, to} local ISO strings for a preset, ending at today. */
function presetRange(id: Exclude<PresetId, 'custom'>): { from: string; to: string } {
  const now = new Date();
  const to = localDateISO(now);
  let from: Date;
  if (id === 'week') from = startOfWeek(now);
  else if (id === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (id === 'quarter') from = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  else from = new Date(now.getFullYear(), 0, 1);
  return { from: localDateISO(from), to };
}

// ── Small UI atoms ───────────────────────────────────────────────────────────
function Chip({ label, value, money }: { label: string; value: number; money?: boolean }) {
  return (
    <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: '14px 20px', flex: '1 1 150px', minWidth: 0 }}>
      <div style={{ color: D.textMut, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
      <div style={{ color: money ? D.green : D.blue, fontSize: 26, fontWeight: 700 }}>{money ? fmtUsd(value) : value.toLocaleString()}</div>
    </div>
  );
}

const cellInput: React.CSSProperties = {
  width: 52, padding: '6px 4px', background: '#0f1117', border: `1px solid #374151`,
  borderRadius: 6, color: D.text, fontSize: 13, textAlign: 'center', outline: 'none', boxSizing: 'border-box',
};
const th: React.CSSProperties = {
  padding: '8px 6px', fontSize: 11, fontWeight: 700, color: D.textMut,
  textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${D.border}`, whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '6px 6px', fontSize: 13, color: D.text, textAlign: 'center', borderBottom: `1px solid ${D.border}`, whiteSpace: 'nowrap',
};

// Tally-strip cell: opaque tinted background (must be opaque — the Date cell is
// position:sticky and would otherwise show the scrolled content behind it) plus
// a hairline rule so the strip reads as a control bar, not a data row.
const TALLY_BG = '#1a1f27';
const tallyTd: React.CSSProperties = {
  padding: '4px 6px', textAlign: 'center', whiteSpace: 'nowrap',
  background: TALLY_BG, borderBottom: `1px solid ${D.border}`,
};
// Hover/active states need real CSS pseudo-classes, which inline styles can't do.
const TALLY_CSS = `
.eon-tally-btn {
  width: 21px; height: 21px; padding: 0; line-height: 1; box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 5px; font-size: 13px; font-weight: 700; cursor: pointer;
  user-select: none; -webkit-user-select: none;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}
.eon-tally-plus { background: rgba(26,107,249,0.16); border: 1px solid ${D.blue}; color: #bfdbfe; }
.eon-tally-plus:hover { background: rgba(26,107,249,0.34); color: #ffffff; }
.eon-tally-plus:active { background: ${D.blue}; color: #ffffff; transform: translateY(1px); }
.eon-tally-minus { background: transparent; border: 1px solid #374151; color: ${D.textMut}; }
.eon-tally-minus:hover { background: rgba(255,255,255,0.05); border-color: ${D.faint}; color: ${D.textSec}; }
.eon-tally-minus:active { background: rgba(255,255,255,0.09); transform: translateY(1px); }
`;

// ── Main component ───────────────────────────────────────────────────────────
export function DailyActivityLog() {
  const initial = presetRange('week');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [preset, setPreset] = useState<PresetId>('week');
  const [grouping, setGrouping] = useState<Grouping>('day');

  const [rows, setRows] = useState<RowMap>({});
  // Auto-derived LinkedIn send counts per LOCAL day (from crm_contacts sent stamps).
  const [autoCounts, setAutoCounts] = useState<Record<string, number>>({});
  const autoCountsRef = useRef<Record<string, number>>({}); // latest autoCounts for async save
  // Auto-derived closed dollar amounts per LOCAL day (from signed MSAs).
  const [autoAmounts, setAutoAmounts] = useState<Record<string, number>>({});
  const autoAmountsRef = useRef<Record<string, number>>({}); // latest autoAmounts for async save
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Per-row save bookkeeping
  const [savingDates, setSavingDates] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const rowsRef = useRef<RowMap>({});           // latest rows for async save
  const savedRef = useRef<RowMap>({});          // last known-good server state (for revert)
  const inFlight = useRef<Set<string>>(new Set());
  const pending = useRef<Set<string>>(new Set());

  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { autoCountsRef.current = autoCounts; }, [autoCounts]);
  useEffect(() => { autoAmountsRef.current = autoAmounts; }, [autoAmounts]);

  const todayISO = localDateISO(new Date());

  // ── Fetch on range change ──────────────────────────────────────────────────
  const load = useCallback(async (f: string, t: string) => {
    setLoading(true); setLoadError('');
    try {
      const { data, error } = await getCrmClient()
        .from('crm_daily_activity')
        .select('*')
        .gte('activity_date', f)
        .lte('activity_date', t)
        .order('activity_date', { ascending: false });
      if (error) throw error;
      const map: RowMap = {};
      for (const raw of (data ?? []) as Record<string, unknown>[]) {
        const date = String(raw.activity_date);
        const r = zeroRow(date);
        for (const c of METRIC_COLS) r[c] = Number(raw[c] ?? 0);
        // Carry the auto/override flag through; default true (auto) when absent.
        r.linkedin_auto = raw.linkedin_auto === false ? false : true;
        // Amount (dollars) + its auto/override flag; default 0 / auto when absent.
        r.amount = Number(raw.amount ?? 0);
        r.amount_auto = raw.amount_auto === false ? false : true;
        map[date] = r;
      }
      savedRef.current = JSON.parse(JSON.stringify(map));
      setRows(map);

      // ── Auto-fill source: count real LinkedIn sends per LOCAL day ────────────
      // Every sent lead stamps msg{1,2,3}_sent_at in custom_fields->linkedin.
      // Skips use _skipped_at and must NOT count.
      const { data: contacts } = await getCrmClient()
        .from('crm_contacts')
        .select('custom_fields')
        .not('custom_fields->linkedin', 'is', null);
      const counts: Record<string, number> = {};
      for (const c of (contacts ?? []) as Record<string, unknown>[]) {
        const cf = c.custom_fields as Record<string, unknown> | null | undefined;
        const li = cf?.linkedin as Record<string, unknown> | null | undefined;
        if (!li || typeof li !== 'object') continue; // guard: linkedin object may be missing
        for (const stamp of ['msg1_sent_at', 'msg2_sent_at', 'msg3_sent_at'] as const) {
          const ts = li[stamp];
          if (!ts) continue;
          const d = new Date(String(ts));
          if (Number.isNaN(d.getTime())) continue;
          const localDate = localDateISO(d);
          counts[localDate] = (counts[localDate] ?? 0) + 1;
        }
      }
      autoCountsRef.current = counts;
      setAutoCounts(counts);

      // ── Auto-fill source: closed dollar amounts per LOCAL day from signed MSAs.
      // The Dojo revenue tables (msas/briefings) are behind RLS the browser CRM
      // client can't cross, so we go through the service-role endpoint.
      try {
        const { data: sess } = await getCrmClient().auth.getSession();
        const token = sess.session?.access_token;
        const res = await fetch('/api/crm/closed-amounts', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const json = (await res.json()) as { amounts?: Record<string, number> };
          const amounts = json.amounts ?? {};
          autoAmountsRef.current = amounts;
          setAutoAmounts(amounts);
        }
      } catch {
        // Non-fatal: amount auto-fill just falls back to stored/zero values.
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load daily activity');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(from, to); }, [from, to, load]);

  // ── Range control handlers ─────────────────────────────────────────────────
  function applyPreset(id: Exclude<PresetId, 'custom'>) {
    const r = presetRange(id);
    setPreset(id); setFrom(r.from); setTo(r.to);
  }
  function editFrom(v: string) { if (v) { setPreset('custom'); setFrom(v); } }
  function editTo(v: string) { if (v) { setPreset('custom'); setTo(v); } }

  // ── Save one day (upsert whole row) with per-row concurrency guard ──────────
  const saveDay = useCallback(async (date: string) => {
    if (inFlight.current.has(date)) { pending.current.add(date); return; }
    inFlight.current.add(date);
    setSavingDates(s => new Set(s).add(date));

    const row = rowsRef.current[date] ?? zeroRow(date);
    // LinkedIn: when auto, snapshot the real send count so the stored column
    // stays in sync; when manually overridden, persist Jeff's typed value.
    const isAuto = row.linkedin_auto !== false;
    const linkedinValue = isAuto ? (autoCountsRef.current[date] ?? 0) : row.linkedin;
    // Amount: when auto, snapshot the live closed-dollar total so the stored
    // column stays in sync; when manually overridden, persist Jeff's value.
    const amountAuto = row.amount_auto !== false;
    const amountValue = amountAuto ? (autoAmountsRef.current[date] ?? 0) : (row.amount ?? 0);
    const payload = {
      activity_date: date,
      phone_calls: row.phone_calls,
      texts: row.texts,
      appts_made: row.appts_made,
      appts_kept_initial: row.appts_kept_initial,
      appts_kept_closing: row.appts_kept_closing,
      closed: row.closed,
      linkedin: linkedinValue,
      linkedin_auto: isAuto,
      amount: amountValue,
      amount_auto: amountAuto,
      instagram: row.instagram,
      facebook: row.facebook,
      tiktok: row.tiktok,
      x: row.x,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await getCrmClient()
        .from('crm_daily_activity')
        .upsert(payload, { onConflict: 'activity_date' });
      if (error) throw error;
      savedRef.current[date] = { ...row };
      setRowErrors(e => { if (!e[date]) return e; const n = { ...e }; delete n[date]; return n; });
    } catch (e) {
      // Revert optimistic update to the last known-good state.
      const good = savedRef.current[date] ?? zeroRow(date);
      setRows(r => ({ ...r, [date]: { ...good } }));
      setRowErrors(er => ({ ...er, [date]: e instanceof Error ? e.message : 'Save failed' }));
    } finally {
      inFlight.current.delete(date);
      setSavingDates(s => { const n = new Set(s); n.delete(date); return n; });
      if (pending.current.has(date)) { pending.current.delete(date); saveDay(date); }
    }
  }, []);

  // ── Tally strip: tap +/− to count a metric for a single day ─────────────────
  /**
   * Bump one count column by ±1 and persist immediately.
   *
   * The ref is written SYNCHRONOUSLY (not from inside the setRows updater, which
   * React may defer to the render phase) because saveDay reads rowsRef.current in
   * its synchronous prologue — this is what makes a rapid burst of taps safe:
   *   • every tap accumulates off the ref, so no increment is lost;
   *   • saveDay's existing inFlight/pending guard coalesces the burst — extra taps
   *     while a write is in flight just set the pending flag, and the trailing
   *     re-save re-reads the ref, so the FINAL value is what lands in the DB.
   * setRows() gives the optimistic UI update, so the number moves on tap with no
   * wait on the network.
   */
  const bumpTally = useCallback((date: string, col: TallyCol, delta: 1 | -1) => {
    const base = rowsRef.current[date] ?? zeroRow(date);
    const nextVal = Math.max(0, base[col] + delta); // − floors at 0, never negative
    const updated: RowMap = { ...rowsRef.current, [date]: { ...base, [col]: nextVal } };
    rowsRef.current = updated;
    setRows(updated);
    saveDay(date);
  }, [saveDay]);

  function editCell(date: string, col: MetricCol, raw: string) {
    const n = raw === '' ? 0 : Math.max(0, Math.floor(Number(raw)) || 0);
    setRows(r => {
      const base = r[date] ?? zeroRow(date);
      const next: DayRow = { ...base, [col]: n };
      // Typing in the LinkedIn cell is a manual override — pin it off auto.
      if (col === 'linkedin') next.linkedin_auto = false;
      return { ...r, [date]: next };
    });
  }

  /** Edit the Amount (dollars) cell — typing pins it off auto (manual override). */
  function editAmount(date: string, raw: string) {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    const n = cleaned === '' ? 0 : Math.max(0, Number(cleaned) || 0);
    setRows(r => {
      const base = r[date] ?? zeroRow(date);
      const next: DayRow = { ...base, amount: n, amount_auto: false };
      return { ...r, [date]: next };
    });
  }

  // ── LinkedIn auto/override resolution ───────────────────────────────────────
  /** Displayed LinkedIn value: auto rows show real sends, manual rows show stored. */
  const resolvedLinkedIn = useCallback(
    (dateISO: string, row: DayRow): number =>
      row.linkedin_auto !== false ? (autoCounts[dateISO] ?? 0) : row.linkedin,
    [autoCounts],
  );
  /** Row total using the resolved LinkedIn value (not the stored column). */
  const resolvedRowTotal = useCallback(
    (dateISO: string, row: DayRow): number => {
      let s = 0;
      for (const c of METRIC_COLS) s += c === 'linkedin' ? resolvedLinkedIn(dateISO, row) : row[c];
      return s;
    },
    [resolvedLinkedIn],
  );
  /** Revert a manually-overridden LinkedIn cell back to the live auto count. */
  const revertToAuto = useCallback((date: string) => {
    setRows(r => {
      const base = r[date] ?? zeroRow(date);
      const next: DayRow = { ...base, linkedin_auto: true, linkedin: autoCountsRef.current[date] ?? 0 };
      const updated = { ...r, [date]: next };
      rowsRef.current = updated; // keep ref fresh for the immediate saveDay
      return updated;
    });
    saveDay(date);
  }, [saveDay]);

  // ── Amount auto/override resolution ─────────────────────────────────────────
  /** Displayed Amount (dollars): auto rows show live closed total, manual show stored. */
  const resolvedAmount = useCallback(
    (dateISO: string, row: DayRow): number =>
      row.amount_auto !== false ? (autoAmounts[dateISO] ?? 0) : (row.amount ?? 0),
    [autoAmounts],
  );
  /** Revert a manually-overridden Amount cell back to the live auto dollar total. */
  const revertAmountToAuto = useCallback((date: string) => {
    setRows(r => {
      const base = r[date] ?? zeroRow(date);
      const next: DayRow = { ...base, amount_auto: true, amount: autoAmountsRef.current[date] ?? 0 };
      const updated = { ...r, [date]: next };
      rowsRef.current = updated; // keep ref fresh for the immediate saveDay
      return updated;
    });
    saveDay(date);
  }, [saveDay]);

  // ── Derived: per-column range totals + grand total (over fetched rows) ──────
  const rangeSums = useMemo(() => {
    const sums = Object.fromEntries(METRIC_COLS.map(c => [c, 0])) as Record<MetricCol, number>;
    for (const d in rows) {
      if (d < from || d > to) continue;
      for (const c of METRIC_COLS) sums[c] += c === 'linkedin' ? resolvedLinkedIn(d, rows[d]) : rows[d][c];
    }
    return sums;
  }, [rows, from, to, resolvedLinkedIn]);
  const grandTotal = useMemo(() => METRIC_COLS.reduce((s, c) => s + rangeSums[c], 0), [rangeSums]);
  // Combined "KEPT" figure across the range = Initial + Closing kept appointments.
  const keptRangeTotal = useMemo(() => KEPT_COLS.reduce((s, c) => s + rangeSums[c], 0), [rangeSums]);
  // Amount is money, NOT an activity count — its own dollar total over the range.
  const rangeAmount = useMemo(() => {
    let s = 0;
    for (const d in rows) {
      if (d < from || d > to) continue;
      s += resolvedAmount(d, rows[d]);
    }
    return s;
  }, [rows, from, to, resolvedAmount]);

  // ── Chips: This Week / This Month (period-to-date) / Range Total ────────────
  const chips = useMemo(() => {
    const now = new Date();
    const weekStart = localDateISO(startOfWeek(now));
    const monthStart = localDateISO(new Date(now.getFullYear(), now.getMonth(), 1));
    let week = 0, month = 0, monthAmount = 0;
    for (const d in rows) {
      const t = resolvedRowTotal(d, rows[d]);
      if (d >= weekStart && d <= todayISO) week += t;
      if (d >= monthStart && d <= todayISO) { month += t; monthAmount += resolvedAmount(d, rows[d]); }
    }
    return { week, month, range: grandTotal, monthAmount };
  }, [rows, grandTotal, todayISO, resolvedRowTotal, resolvedAmount]);

  // ── Day rows (editable) ─────────────────────────────────────────────────────
  const dayList = useMemo(() => {
    const list = daysDesc(from, to);
    // Guarantee TODAY is present as the top editable row when it falls in range.
    if (todayISO >= from && todayISO <= to && !list.includes(todayISO)) list.unshift(todayISO);
    return list;
  }, [from, to, todayISO]);

  // ── Week / Month rollup rows (read-only) ────────────────────────────────────
  const rollups = useMemo(() => {
    if (grouping === 'day') return [];
    const groups = new Map<string, { key: string; label: string; sums: Record<MetricCol, number>; amount: number }>();
    for (const d in rows) {
      if (d < from || d > to) continue;
      const date = parseLocalISO(d);
      let key: string, label: string;
      if (grouping === 'week') {
        const ws = startOfWeek(date);
        key = localDateISO(ws);
        label = `Week of ${MONTHS_SHORT[ws.getMonth()]} ${ws.getDate()}`;
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        label = `${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
      }
      let g = groups.get(key);
      if (!g) { g = { key, label, sums: Object.fromEntries(METRIC_COLS.map(c => [c, 0])) as Record<MetricCol, number>, amount: 0 }; groups.set(key, g); }
      for (const c of METRIC_COLS) g.sums[c] += c === 'linkedin' ? resolvedLinkedIn(d, rows[d]) : rows[d][c];
      g.amount += resolvedAmount(d, rows[d]);
    }
    return [...groups.values()].sort((a, b) => (a.key < b.key ? 1 : -1)); // most recent first
  }, [rows, grouping, from, to, resolvedLinkedIn, resolvedAmount]);

  // ── Render ──────────────────────────────────────────────────────────────────
  const btn = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    background: active ? D.blue : 'transparent', color: active ? '#fff' : D.textSec,
  });
  const dateInput: React.CSSProperties = {
    padding: '6px 10px', background: '#0f1117', border: `1px solid #374151`, borderRadius: 8,
    color: D.text, fontSize: 13, outline: 'none', colorScheme: 'dark',
  };

  return (
    <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
      <style>{TALLY_CSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
        <h2 style={{ color: D.text, fontSize: 20, fontWeight: 700, margin: 0 }}>Daily Activity Log</h2>
        {/* Grouping toggle */}
        <div style={{ display: 'flex', gap: 4, background: D.panel, border: `1px solid ${D.border}`, borderRadius: 8, padding: 4 }}>
          {(['day', 'week', 'month'] as Grouping[]).map(g => (
            <button key={g} onClick={() => setGrouping(g)} style={btn(grouping === g)}>
              {g === 'day' ? 'Day' : g === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>
      <p style={{ color: D.textMut, fontSize: 13, margin: '0 0 16px' }}>
        Manually log your daily outreach numbers. Type a count in any cell — it saves when you click away.
      </p>

      {/* Range control */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 4, background: D.panel, border: `1px solid ${D.border}`, borderRadius: 8, padding: 4 }}>
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => applyPreset(p.id as Exclude<PresetId, 'custom'>)} style={btn(preset === p.id)}>{p.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: D.textMut, fontSize: 12 }}>From</span>
          <input type="date" value={from} max={to} onChange={e => editFrom(e.target.value)} style={dateInput} />
          <span style={{ color: D.textMut, fontSize: 12 }}>To</span>
          <input type="date" value={to} min={from} onChange={e => editTo(e.target.value)} style={dateInput} />
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
        <Chip label="This Week" value={chips.week} />
        <Chip label="This Month" value={chips.month} />
        <Chip label="Range Total" value={chips.range} />
        <Chip label="Closed $ (Range)" value={rangeAmount} money />
        <Chip label="This Month $" value={chips.monthAmount} money />
      </div>

      {loadError && (
        <div style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '12px 14px', fontSize: 13, marginBottom: 14 }}>
          {loadError}
        </div>
      )}
      {loading && <div style={{ color: D.textMut, padding: 30, textAlign: 'center' }}>Loading…</div>}

      {!loading && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
            <thead>
              {/* Top tier: single-label headers rowSpan both tiers; the KEPT group
                  spans the two Kept sub-columns with a bracket rule + combined total. */}
              <tr>
                <th rowSpan={2} style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, background: D.card }}>Date</th>
                {METRICS.map(m => {
                  // Render the bracketed KEPT group once, at the first Kept column…
                  if (m.col === 'appts_kept_initial') {
                    return (
                      <th
                        key="kept-group"
                        colSpan={2}
                        title="Appointments kept — Initial + Closing"
                        style={{ ...th, textAlign: 'center', color: D.textSec, borderBottom: `2px solid ${D.textMut}`, paddingBottom: 4 }}
                      >
                        KEPT · {keptRangeTotal}
                      </th>
                    );
                  }
                  // …and skip the second Kept column here (covered by the colSpan).
                  if (m.col === 'appts_kept_closing') return null;
                  return (
                    <Fragment key={m.col}>
                      <th rowSpan={2} style={th} title={m.label}>{m.abbr}</th>
                      {m.col === 'closed' && <th rowSpan={2} style={{ ...th, color: D.green }} title="Closed deal $ — auto-filled from signed MSAs">Amount</th>}
                    </Fragment>
                  );
                })}
                <th rowSpan={2} style={{ ...th, color: D.textSec }}>Day Total</th>
              </tr>
              {/* Bottom tier: only the two Kept sub-column labels sit under the bracket. */}
              <tr>
                {KEPT_COLS.map(c => {
                  const m = METRICS.find(x => x.col === c)!;
                  return <th key={c} style={th} title={`APPTS Kept — ${m.label}`}>{m.abbr}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {grouping === 'day' && dayList.map(date => {
                const row = rows[date] ?? zeroRow(date);
                const saving = savingDates.has(date);
                const isToday = date === todayISO;
                const dObj = parseLocalISO(date);
                const dateLabel = `${MONTHS_SHORT[dObj.getMonth()]} ${dObj.getDate()}`;
                return (
                  <Fragment key={date}>
                  {/* ── Tally strip — sits directly ABOVE today's row. Only rendered in
                      Day grouping (this map only runs then) and only when TODAY is in
                      the selected range (dayList only contains today when from ≤ today ≤ to).
                      Cell count MUST match a body row: Date + 11 metrics + Amount + Day Total = 14.
                      The KEPT pair is two separate body cells, so it gets two cells here too. */}
                  {isToday && (
                    <tr>
                      <td style={{ ...tallyTd, textAlign: 'left', position: 'sticky', left: 0, background: TALLY_BG }}>
                        <span style={{ color: D.textMut, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Tap to count
                        </span>
                      </td>
                      {METRIC_COLS.map(col => {
                        const label = METRICS.find(m => m.col === col)!.label;
                        const cell = (
                          <td key={col} style={tallyTd}>
                            {isTallyCol(col) && (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
                                <button
                                  type="button" className="eon-tally-btn eon-tally-minus"
                                  onClick={() => bumpTally(date, col, -1)}
                                  aria-label={`Subtract one from ${label}`} title={`−1 ${label}`}
                                >−</button>
                                <button
                                  type="button" className="eon-tally-btn eon-tally-plus"
                                  onClick={() => bumpTally(date, col, 1)}
                                  aria-label={`Add one to ${label}`} title={`+1 ${label}`}
                                >+</button>
                              </div>
                            )}
                          </td>
                        );
                        // Amount (money) has no buttons, but its cell must exist to hold alignment.
                        if (col === 'closed') return <Fragment key={col}>{cell}<td style={tallyTd} /></Fragment>;
                        return cell;
                      })}
                      <td style={tallyTd} />
                    </tr>
                  )}
                  <tr>
                    <td style={{ ...td, textAlign: 'left', color: isToday ? D.blue : D.text, fontWeight: isToday ? 700 : 400, position: 'sticky', left: 0, background: D.card }}>
                      {dateLabel}{isToday ? ' · Today' : ''}
                      {saving && <span style={{ color: D.textMut, fontSize: 10, marginLeft: 6 }}>saving…</span>}
                      {rowErrors[date] && <span style={{ color: D.red, fontSize: 10, marginLeft: 6 }}>save failed</span>}
                    </td>
                    {METRIC_COLS.map(col => {
                      let cell: React.ReactNode;
                      if (col === 'linkedin') {
                        const isAuto = row.linkedin_auto !== false;
                        const liVal = resolvedLinkedIn(date, row);
                        cell = (
                          <td key={col} style={td}>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              <input
                                inputMode="numeric" min={0}
                                value={liVal === 0 ? '' : liVal}
                                onChange={e => editCell(date, 'linkedin', e.target.value)}
                                onBlur={() => saveDay(date)}
                                title={isAuto ? 'Auto-filled from real LinkedIn sends — type to override' : 'Manual override'}
                                style={isAuto ? { ...cellInput, borderColor: D.blue, background: 'rgba(26,107,249,0.12)' } : cellInput}
                              />
                              {isAuto ? (
                                <span style={{ color: D.blue, fontSize: 9, fontWeight: 700, letterSpacing: '0.03em' }}>⚡ auto</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => revertToAuto(date)}
                                  title="Revert to auto-filled send count"
                                  style={{ background: 'transparent', border: 'none', color: D.textMut, fontSize: 9, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                >↻ auto</button>
                              )}
                            </div>
                          </td>
                        );
                      } else {
                        cell = (
                          <td key={col} style={td}>
                            <input
                              inputMode="numeric" min={0}
                              value={row[col] === 0 ? '' : row[col]}
                              onChange={e => editCell(date, col, e.target.value)}
                              onBlur={() => saveDay(date)}
                              style={cellInput}
                            />
                          </td>
                        );
                      }
                      // Amount (money) column sits immediately after Closed.
                      if (col === 'closed') {
                        const amtAuto = row.amount_auto !== false;
                        const amtVal = resolvedAmount(date, row);
                        return (
                          <Fragment key={col}>
                            {cell}
                            <td style={td}>
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                  <span style={{ color: D.green, fontSize: 13, fontWeight: 700, marginRight: 2 }}>$</span>
                                  <input
                                    inputMode="decimal"
                                    value={amtVal === 0 ? '' : Math.round(amtVal).toLocaleString()}
                                    onChange={e => editAmount(date, e.target.value)}
                                    onBlur={() => saveDay(date)}
                                    title={amtAuto ? 'Auto-filled from signed Mission Service Agreements — type to override' : 'Manual override'}
                                    style={amtAuto
                                      ? { ...cellInput, width: 84, textAlign: 'right', borderColor: D.green, background: 'rgba(22,163,74,0.12)' }
                                      : { ...cellInput, width: 84, textAlign: 'right' }}
                                  />
                                </div>
                                {amtAuto ? (
                                  <span style={{ color: D.green, fontSize: 9, fontWeight: 700, letterSpacing: '0.03em' }}>⚡ auto</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => revertAmountToAuto(date)}
                                    title="Revert to auto-filled closed amount"
                                    style={{ background: 'transparent', border: 'none', color: D.textMut, fontSize: 9, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                  >↻ auto</button>
                                )}
                              </div>
                            </td>
                          </Fragment>
                        );
                      }
                      return cell;
                    })}
                    <td style={{ ...td, fontWeight: 700, color: D.text }}>{resolvedRowTotal(date, row)}</td>
                  </tr>
                  </Fragment>
                );
              })}

              {grouping !== 'day' && rollups.map(g => (
                <tr key={g.key}>
                  <td style={{ ...td, textAlign: 'left', color: D.text, position: 'sticky', left: 0, background: D.card }}>{g.label}</td>
                  {METRIC_COLS.map(col => (
                    <Fragment key={col}>
                      <td style={td}>{g.sums[col]}</td>
                      {col === 'closed' && <td style={{ ...td, color: D.green, fontWeight: 700 }}>{fmtUsd(g.amount)}</td>}
                    </Fragment>
                  ))}
                  <td style={{ ...td, fontWeight: 700 }}>{METRIC_COLS.reduce((s, c) => s + g.sums[c], 0)}</td>
                </tr>
              ))}

              {grouping !== 'day' && rollups.length === 0 && (
                <tr><td colSpan={METRICS.length + 3} style={{ ...td, color: D.textMut, fontStyle: 'italic', textAlign: 'center', padding: 24 }}>No activity logged in this range yet.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...td, textAlign: 'left', fontWeight: 700, color: D.textSec, borderTop: `2px solid ${D.border}`, position: 'sticky', left: 0, background: D.card }}>TOTALS</td>
                {METRIC_COLS.map(col => (
                  <Fragment key={col}>
                    <td style={{ ...td, fontWeight: 700, color: D.text, borderTop: `2px solid ${D.border}` }}>{rangeSums[col]}</td>
                    {col === 'closed' && <td style={{ ...td, fontWeight: 700, color: D.green, borderTop: `2px solid ${D.border}` }}>{fmtUsd(rangeAmount)}</td>}
                  </Fragment>
                ))}
                <td style={{ ...td, fontWeight: 700, color: D.blue, borderTop: `2px solid ${D.border}` }}>{grandTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
