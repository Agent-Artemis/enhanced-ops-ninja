'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  { col: 'appts_kept', label: 'APPTS Kept', abbr: 'Kept' },
  { col: 'reschedules', label: 'Reschedules', abbr: 'Resch' },
  { col: 'linkedin', label: 'LinkedIn', abbr: 'LinkedIn' },
  { col: 'instagram', label: 'Instagram', abbr: 'Insta' },
  { col: 'facebook', label: 'Facebook', abbr: 'FB' },
  { col: 'tiktok', label: 'TikTok', abbr: 'TikTok' },
  { col: 'x', label: 'X', abbr: 'X' },
] as const;

type MetricCol = (typeof METRICS)[number]['col'];
const METRIC_COLS = METRICS.map(m => m.col) as MetricCol[];

// Week starts MONDAY (ISO week). Flip this to 0 to make weeks start Sunday.
const WEEK_START_DOW = 1;

type DayRow = { activity_date: string; linkedin_auto?: boolean } & Record<MetricCol, number>;
type RowMap = Record<string, DayRow>;
type Grouping = 'day' | 'week' | 'month';

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
function Chip({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: '14px 20px', flex: '1 1 150px', minWidth: 0 }}>
      <div style={{ color: D.textMut, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
      <div style={{ color: D.blue, fontSize: 26, fontWeight: 700 }}>{value.toLocaleString()}</div>
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

// ── Main component ───────────────────────────────────────────────────────────
export function DailyActivityLog() {
  const initial = presetRange('month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [preset, setPreset] = useState<PresetId>('month');
  const [grouping, setGrouping] = useState<Grouping>('day');

  const [rows, setRows] = useState<RowMap>({});
  // Auto-derived LinkedIn send counts per LOCAL day (from crm_contacts sent stamps).
  const [autoCounts, setAutoCounts] = useState<Record<string, number>>({});
  const autoCountsRef = useRef<Record<string, number>>({}); // latest autoCounts for async save
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
    const payload = {
      activity_date: date,
      phone_calls: row.phone_calls,
      texts: row.texts,
      appts_made: row.appts_made,
      appts_kept: row.appts_kept,
      reschedules: row.reschedules,
      linkedin: linkedinValue,
      linkedin_auto: isAuto,
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

  // ── Chips: This Week / This Month (period-to-date) / Range Total ────────────
  const chips = useMemo(() => {
    const now = new Date();
    const weekStart = localDateISO(startOfWeek(now));
    const monthStart = localDateISO(new Date(now.getFullYear(), now.getMonth(), 1));
    let week = 0, month = 0;
    for (const d in rows) {
      const t = resolvedRowTotal(d, rows[d]);
      if (d >= weekStart && d <= todayISO) week += t;
      if (d >= monthStart && d <= todayISO) month += t;
    }
    return { week, month, range: grandTotal };
  }, [rows, grandTotal, todayISO, resolvedRowTotal]);

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
    const groups = new Map<string, { key: string; label: string; sums: Record<MetricCol, number> }>();
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
      if (!g) { g = { key, label, sums: Object.fromEntries(METRIC_COLS.map(c => [c, 0])) as Record<MetricCol, number> }; groups.set(key, g); }
      for (const c of METRIC_COLS) g.sums[c] += c === 'linkedin' ? resolvedLinkedIn(d, rows[d]) : rows[d][c];
    }
    return [...groups.values()].sort((a, b) => (a.key < b.key ? 1 : -1)); // most recent first
  }, [rows, grouping, from, to, resolvedLinkedIn]);

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
              <tr>
                <th style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, background: D.card }}>Date</th>
                {METRICS.map(m => <th key={m.col} style={th} title={m.label}>{m.abbr}</th>)}
                <th style={{ ...th, color: D.textSec }}>Day Total</th>
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
                  <tr key={date}>
                    <td style={{ ...td, textAlign: 'left', color: isToday ? D.blue : D.text, fontWeight: isToday ? 700 : 400, position: 'sticky', left: 0, background: D.card }}>
                      {dateLabel}{isToday ? ' · Today' : ''}
                      {saving && <span style={{ color: D.textMut, fontSize: 10, marginLeft: 6 }}>saving…</span>}
                      {rowErrors[date] && <span style={{ color: D.red, fontSize: 10, marginLeft: 6 }}>save failed</span>}
                    </td>
                    {METRIC_COLS.map(col => {
                      if (col === 'linkedin') {
                        const isAuto = row.linkedin_auto !== false;
                        const liVal = resolvedLinkedIn(date, row);
                        return (
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
                      }
                      return (
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
                    })}
                    <td style={{ ...td, fontWeight: 700, color: D.text }}>{resolvedRowTotal(date, row)}</td>
                  </tr>
                );
              })}

              {grouping !== 'day' && rollups.map(g => (
                <tr key={g.key}>
                  <td style={{ ...td, textAlign: 'left', color: D.text, position: 'sticky', left: 0, background: D.card }}>{g.label}</td>
                  {METRIC_COLS.map(col => <td key={col} style={td}>{g.sums[col]}</td>)}
                  <td style={{ ...td, fontWeight: 700 }}>{METRIC_COLS.reduce((s, c) => s + g.sums[c], 0)}</td>
                </tr>
              ))}

              {grouping !== 'day' && rollups.length === 0 && (
                <tr><td colSpan={METRICS.length + 2} style={{ ...td, color: D.textMut, fontStyle: 'italic', textAlign: 'center', padding: 24 }}>No activity logged in this range yet.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...td, textAlign: 'left', fontWeight: 700, color: D.textSec, borderTop: `2px solid ${D.border}`, position: 'sticky', left: 0, background: D.card }}>TOTALS</td>
                {METRIC_COLS.map(col => (
                  <td key={col} style={{ ...td, fontWeight: 700, color: D.text, borderTop: `2px solid ${D.border}` }}>{rangeSums[col]}</td>
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
