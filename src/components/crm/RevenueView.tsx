'use client';

/* ════════════════════════════════════════════════════════════════════════════
   REVENUE — open cases, projections, and live income against target.

   ⛔ THE RULE THAT MATTERS MOST: THERE IS NO SINGLE PROJECTION TOTAL ANYWHERE ON
   THIS SCREEN. Most of the plan is unsigned, and one blended number reads like
   money in the bank. Every month is shown as separate bands — LIVE, SIGNED,
   UNSIGNED (verbal + pending decision), AT RISK — and they are never added into
   one figure. "Current income vs target" uses LIVE ONLY.

   ⛔ "This month" comes from the viewer's clock at render. No month is hard-coded.

   Data is read and written with the viewer's own session, so Postgres RLS
   (crm_revenue_admin()) decides what comes back — this component never trusts
   itself to hide anything.
   ════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCrmClient } from '@/lib/crm/client';

type Status = 'live' | 'signed' | 'verbal' | 'pending_decision' | 'at_risk' | 'lost';
type Accredited = 'yes' | 'no' | 'unknown';
type Band = 'live' | 'signed' | 'unsigned' | 'at_risk';

interface Line {
  id: string; name: string; contact_id: string | null; product: string | null;
  status: Status; recurring: boolean; decision_date: string | null;
  decision_note: string | null; next_action: string | null; notes: string | null;
}
interface Sched { id: string; line_id: string; month: string; amount: number }
interface Target { id: string; month: string | null; target_amount: number }
interface Invest {
  id: string; investor: string; amount: number; instrument: string;
  status: Status; accredited: Accredited; notes: string | null;
}

const D = {
  bg: '#1A1A1A', card: '#111111', panel: '#161616', border: '#2d2d2d',
  text: '#FFFFFF', sec: '#9ca3af', mut: '#6b7280', blue: '#1A6BF9',
  green: '#16a34a', amber: '#f59e0b', red: '#ef4444', violet: '#a78bfa',
};

const STATUSES: { id: Status; label: string; color: string }[] = [
  { id: 'live', label: 'Live', color: D.green },
  { id: 'signed', label: 'Signed', color: D.blue },
  { id: 'verbal', label: 'Verbal', color: D.amber },
  { id: 'pending_decision', label: 'Pending decision', color: D.violet },
  { id: 'at_risk', label: 'At risk', color: D.red },
  { id: 'lost', label: 'Lost', color: D.mut },
];
const statusMeta = (s: Status) => STATUSES.find(x => x.id === s) ?? STATUSES[2];

const BANDS: { id: Band; label: string; color: string; hint: string }[] = [
  { id: 'live', label: 'Live', color: D.green, hint: 'paying now' },
  { id: 'signed', label: 'Signed', color: D.blue, hint: 'contract, not yet paying' },
  { id: 'unsigned', label: 'Unsigned', color: D.amber, hint: 'verbal or pending decision' },
  { id: 'at_risk', label: 'At risk', color: D.red, hint: 'in danger' },
];
function bandOf(s: Status): Band | null {
  if (s === 'live') return 'live';
  if (s === 'signed') return 'signed';
  if (s === 'verbal' || s === 'pending_decision') return 'unsigned';
  if (s === 'at_risk') return 'at_risk';
  return null; // lost: excluded from every band
}

// ── Months, always from the viewer's clock ──────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
const norm = (dbDate: string) => `${dbDate.slice(0, 7)}-01`;
function addMonths(key: string, n: number) {
  const [y, m] = key.split('-').map(Number);
  return keyOf(new Date(y, m - 1 + n, 1));
}
function monthLabel(key: string, long = false) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: long ? 'long' : 'short', year: 'numeric' });
}
const usd = (n: number) => '$' + Math.round(n).toLocaleString();

function daysUntil(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const t = new Date(); const today = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  return Math.round((target - today) / 86400000);
}
function whenText(dateStr: string | null) {
  if (!dateStr) return { text: 'No decision date set', color: D.mut };
  const n = daysUntil(dateStr);
  const nice = new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (n < 0) return { text: `${nice} — ${-n} day${n === -1 ? '' : 's'} overdue`, color: D.red };
  if (n === 0) return { text: `${nice} — today`, color: D.amber };
  return { text: `${nice} — in ${n} day${n === 1 ? '' : 's'}`, color: n <= 7 ? D.amber : D.sec };
}

// ── Amount for one line in one month ────────────────────────────────────────
// An explicit schedule row wins. A RECURRING line continues at its last amount
// after its last scheduled month, and that is marked as a continuation so it is
// never mistaken for a figure Jeff typed.
function amountFor(line: Line, month: string, rows: Sched[]) {
  const mine = rows.filter(r => r.line_id === line.id);
  const exact = mine.find(r => norm(r.month) === month);
  if (exact) return { amount: Number(exact.amount), continued: false };
  if (!line.recurring || mine.length === 0) return { amount: 0, continued: false };
  const last = [...mine].sort((a, b) => norm(b.month).localeCompare(norm(a.month)))[0];
  if (month > norm(last.month)) return { amount: Number(last.amount), continued: true };
  return { amount: 0, continued: false };
}

const CSS = `
.rev{background:${D.bg};min-height:calc(100vh - var(--crm-top, 88px));padding:22px 20px 70px;color:${D.text};box-sizing:border-box}
.rev *{box-sizing:border-box}
.rev-wrap{max-width:1180px;margin:0 auto}
.rev h1{font-size:24px;margin:0 0 4px;font-weight:700}
.rev-sub{color:${D.sec};font-size:13.5px;margin:0 0 20px;max-width:70ch;line-height:1.5}
.rev-sec{margin:0 0 26px}
.rev-sec-hd{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:0 0 10px}
.rev-sec-hd h2{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${D.sec};margin:0}
.rev-card{background:${D.card};border:1px solid ${D.border};border-radius:12px;padding:16px}
.rev-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr))}
.rev-btn{min-height:40px;padding:0 14px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:transparent;
  color:#e5e7eb;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit}
.rev-btn.pri{background:${D.blue};border-color:${D.blue};color:#fff}
.rev-btn.dng{border-color:rgba(239,68,68,.5);color:#fca5a5}
.rev-btn:disabled{opacity:.6;cursor:default}
.rev-in,.rev-sel,.rev-ta{width:100%;min-height:42px;background:#0f1117;border:1px solid #374151;border-radius:8px;
  color:#fff;padding:8px 10px;font-size:16px;font-family:inherit}
.rev-ta{min-height:70px;resize:vertical}
.rev-lbl{display:block;font-size:11.5px;font-weight:700;color:${D.mut};text-transform:uppercase;letter-spacing:.06em;margin:12px 0 5px}
.rev-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap}
.rev-row{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
.rev-row>*{min-width:0}
.rev-tap{width:100%;text-align:left;background:transparent;border:0;color:inherit;font:inherit;padding:0;cursor:pointer}
.rev-bar{height:10px;background:#1f2937;border-radius:6px;overflow:hidden;margin:12px 0 8px}
.rev-bar>i{display:block;height:100%;background:${D.green}}
.rev-band{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px dashed #262626;font-size:14px}
.rev-band:last-of-type{border-bottom:0}
.rev-band b{font-variant-numeric:tabular-nums}
.rev details summary{cursor:pointer;color:${D.sec};font-size:12.5px;margin-top:8px;min-height:32px;display:flex;align-items:center}
.rev-sheet-scrim{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:60}
.rev-sheet{position:fixed;z-index:61;background:#141414;border:1px solid ${D.border};overflow-y:auto;padding:16px 16px 22px;
  right:0;top:0;bottom:0;width:min(460px,100vw)}
@media (max-width:640px){
  .rev{padding:16px 12px 60px}
  .rev-sheet{top:auto;left:0;width:100vw;max-height:92vh;border-radius:14px 14px 0 0}
}
.rev-sched{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) auto;gap:6px;align-items:center;margin-bottom:6px}
.rev-err{color:#fca5a5;font-size:13px;margin-top:10px}
@media print{.rev-sheet,.rev-sheet-scrim{display:none!important}}
`;

// ════════════════════════════════════════════════════════════════════════════
export function RevenueView() {
  const sb = getCrmClient();
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [rows, setRows] = useState<Sched[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [invest, setInvest] = useState<Invest[]>([]);
  const [horizon, setHorizon] = useState<6 | 12>(6);
  const [editLine, setEditLine] = useState<Line | 'new' | null>(null);
  const [editInv, setEditInv] = useState<Invest | 'new' | null>(null);
  const [editTarget, setEditTarget] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [a, l, s, t, i] = await Promise.all([
        sb.rpc('crm_revenue_admin'),
        sb.from('crm_revenue_lines').select('*').order('name'),
        sb.from('crm_revenue_schedule').select('*'),
        sb.from('crm_revenue_targets').select('*'),
        sb.from('crm_investments').select('*').order('investor'),
      ]);
      setAdmin(a.data === true);
      const firstErr = [l.error, s.error, t.error, i.error].find(Boolean);
      if (firstErr) throw firstErr;
      setLines((l.data ?? []) as Line[]);
      setRows(((s.data ?? []) as Sched[]).map(r => ({ ...r, amount: Number(r.amount) })));
      setTargets(((t.data ?? []) as Target[]).map(r => ({ ...r, target_amount: Number(r.target_amount) })));
      setInvest(((i.data ?? []) as Invest[]).map(r => ({ ...r, amount: Number(r.amount) })));
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [sb]);

  useEffect(() => { load(); }, [load]);

  // ⛔ Recomputed every render from the viewer's clock.
  const thisMonth = keyOf(new Date());

  const months = useMemo(() => {
    const keys = Array.from({ length: horizon }, (_, n) => addMonths(thisMonth, n));
    return keys.map(key => {
      const byBand: Record<Band, { line: Line; amount: number; continued: boolean }[]> =
        { live: [], signed: [], unsigned: [], at_risk: [] };
      for (const line of lines) {
        const band = bandOf(line.status);
        if (!band) continue;
        const { amount, continued } = amountFor(line, key, rows);
        if (amount > 0) byBand[band].push({ line, amount, continued });
      }
      const sums = Object.fromEntries(BANDS.map(b => [b.id, byBand[b.id].reduce((a, x) => a + x.amount, 0)])) as Record<Band, number>;
      // Concentration: the two largest lines as a share of everything scheduled
      // that month. It is a RATIO — the total it divides by is never displayed.
      const all = BANDS.flatMap(b => byBand[b.id]).sort((a, b) => b.amount - a.amount);
      const denom = all.reduce((a, x) => a + x.amount, 0);
      const top2 = all.slice(0, 2);
      const share = denom > 0 ? top2.reduce((a, x) => a + x.amount, 0) / denom : null;
      return { key, byBand, sums, top2, share };
    });
  }, [horizon, lines, rows, thisMonth]);

  const liveNow = useMemo(
    () => lines.filter(l => l.status === 'live').reduce((a, l) => a + amountFor(l, thisMonth, rows).amount, 0),
    [lines, rows, thisMonth],
  );
  const target = useMemo(() => {
    const dated = targets.find(t => t.month && norm(t.month) === thisMonth);
    const standing = targets.find(t => !t.month);
    const future = targets.filter(t => t.month && norm(t.month) > thisMonth).sort((a, b) => (a.month! < b.month! ? -1 : 1))[0];
    return { row: dated ?? standing ?? null, dated: !!dated, standing, future };
  }, [targets, thisMonth]);

  const openCases = useMemo(
    () => lines
      .filter(l => l.status !== 'live' && l.status !== 'lost')
      .sort((a, b) => {
        if (a.decision_date && b.decision_date) return a.decision_date.localeCompare(b.decision_date);
        if (a.decision_date) return -1;
        if (b.decision_date) return 1;
        return a.name.localeCompare(b.name);
      }),
    [lines],
  );

  async function quickStatus(line: Line, status: Status) {
    const prev = lines;
    setLines(ls => ls.map(l => (l.id === line.id ? { ...l, status } : l)));
    const { error: e } = await sb.from('crm_revenue_lines').update({ status, updated_at: new Date().toISOString() }).eq('id', line.id);
    if (e) { setLines(prev); setError(e.message); }
  }
  async function quickInvest(inv: Invest, patch: Partial<Invest>) {
    const prev = invest;
    setInvest(xs => xs.map(x => (x.id === inv.id ? { ...x, ...patch } : x)));
    const { error: e } = await sb.from('crm_investments').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', inv.id);
    if (e) { setInvest(prev); setError(e.message); }
  }

  if (loading) return <div className="rev"><style>{CSS}</style><div className="rev-wrap" style={{ color: D.sec }}>Loading revenue…</div></div>;

  if (admin === false) {
    return (
      <div className="rev"><style>{CSS}</style>
        <div className="rev-wrap">
          <h1>Revenue</h1>
          <div className="rev-card" style={{ color: D.sec, maxWidth: 560 }}>
            Revenue is restricted to Jeff. Your account can use the rest of the CRM normally.
          </div>
        </div>
      </div>
    );
  }

  const pctLive = target.row && target.row.target_amount > 0 ? Math.min(liveNow / target.row.target_amount, 1) : 0;

  return (
    <div className="rev">
      <style>{CSS}</style>
      <div className="rev-wrap">
        <h1>Revenue</h1>
        <p className="rev-sub">
          Open cases, projections and live income against target. Every month is split by status — live,
          signed, unsigned, at risk — and <b style={{ color: D.text }}>never added into one projection figure</b>,
          because most of it is not signed.
        </p>
        {error && <div className="rev-err" role="alert">Couldn’t load or save: {error}</div>}

        {/* ── THIS MONTH: LIVE ONLY ── */}
        <section className="rev-sec">
          <div className="rev-sec-hd">
            <h2>This month · {monthLabel(thisMonth, true)}</h2>
            <button className="rev-btn" onClick={() => setEditTarget(true)}>Edit target</button>
          </div>
          <div className="rev-card" data-print="card">
            <div style={{ color: D.mut, fontSize: 11.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' }}>
              Current income — live only
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, color: D.green, fontVariantNumeric: 'tabular-nums' }}>{usd(liveNow)}</div>
            {target.row ? (
              <>
                <div className="rev-bar" aria-hidden="true"><i style={{ width: `${pctLive * 100}%` }} /></div>
                <div style={{ fontSize: 14, color: D.sec }}>
                  of <b style={{ color: D.text }}>{usd(target.row.target_amount)}</b> target ·{' '}
                  {Math.round((liveNow / (target.row.target_amount || 1)) * 100)}% ·{' '}
                  {liveNow >= target.row.target_amount
                    ? <b style={{ color: D.green }}>target met</b>
                    : <>gap <b style={{ color: D.text }}>{usd(target.row.target_amount - liveNow)}</b></>}
                </div>
                {!target.dated && (
                  <div style={{ fontSize: 12.5, color: D.amber, marginTop: 6 }}>
                    Standing monthly target — no target date set{target.future ? ` (next dated target: ${monthLabel(norm(target.future.month!))})` : ''}.
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13.5, color: D.sec, marginTop: 6 }}>No target set.</div>
            )}
            <div style={{ fontSize: 12.5, color: D.mut, marginTop: 8 }}>
              Signed and unsigned money is deliberately not counted here.
            </div>
          </div>
        </section>

        {/* ── OPEN CASES: NEXT DECISION FIRST ── */}
        <section className="rev-sec">
          <div className="rev-sec-hd">
            <h2>Open cases · next decision first</h2>
            <button className="rev-btn" onClick={() => setEditLine('new')}>+ Add line</button>
          </div>
          {openCases.length === 0 && <div className="rev-card" style={{ color: D.sec }}>No open cases.</div>}
          <div style={{ display: 'grid', gap: 8 }}>
            {openCases.map(l => {
              const w = whenText(l.decision_date);
              const sm = statusMeta(l.status);
              return (
                <div key={l.id} className="rev-card" data-print="row" style={{ padding: 14 }}>
                  <div className="rev-row">
                    <button className="rev-tap" style={{ flex: '1 1 200px' }} onClick={() => setEditLine(l)}>
                      <div style={{ fontWeight: 700, fontSize: 15.5 }}>{l.name}</div>
                      <div style={{ fontSize: 13, color: w.color, marginTop: 3 }}>{w.text}</div>
                      {l.decision_note && <div style={{ fontSize: 13, color: D.sec, marginTop: 4, lineHeight: 1.45 }}>{l.decision_note}</div>}
                      {l.next_action && <div style={{ fontSize: 13, color: D.text, marginTop: 4 }}>Next: {l.next_action}</div>}
                    </button>
                    <label style={{ flex: '0 0 auto', minWidth: 160 }}>
                      <span className="rev-lbl" style={{ margin: '0 0 4px' }}>Status</span>
                      <select
                        className="rev-sel"
                        value={l.status}
                        onChange={e => quickStatus(l, e.target.value as Status)}
                        style={{ borderColor: sm.color }}
                      >
                        {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── PROJECTION: BANDS, NEVER BLENDED ── */}
        <section className="rev-sec">
          <div className="rev-sec-hd">
            <h2>Projection by month</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              {([6, 12] as const).map(n => (
                <button key={n} className={`rev-btn${horizon === n ? ' pri' : ''}`} onClick={() => setHorizon(n)} aria-pressed={horizon === n}>
                  {n} months
                </button>
              ))}
            </div>
          </div>
          <div className="rev-grid">
            {months.map(m => (
              <div key={m.key} className="rev-card" data-print="card">
                <div className="rev-row" style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{monthLabel(m.key)}</div>
                  {m.key === thisMonth && <span className="rev-chip" style={{ background: 'rgba(26,107,249,.18)', color: '#93b4ff' }}>this month</span>}
                </div>
                {BANDS.map(b => (b.id === 'at_risk' && m.sums.at_risk === 0) ? null : (
                  <div key={b.id} className="rev-band">
                    <span style={{ color: b.color }}>{b.label}</span>
                    <b style={{ color: m.sums[b.id] > 0 ? D.text : D.mut }}>{usd(m.sums[b.id])}</b>
                  </div>
                ))}
                {m.share !== null && m.top2.length > 0 && (
                  <div style={{ fontSize: 12.5, marginTop: 8, color: m.share >= 0.5 ? D.amber : D.sec, lineHeight: 1.45 }}>
                    {m.top2.length === 1
                      ? <>All of this month rests on <b style={{ color: D.text }}>{m.top2[0].line.name}</b>.</>
                      : <>Top two — <b style={{ color: D.text }}>{m.top2[0].line.name}</b> + <b style={{ color: D.text }}>{m.top2[1].line.name}</b> — are <b>{Math.round(m.share * 100)}%</b> of this month.</>}
                  </div>
                )}
                <details>
                  <summary>Lines</summary>
                  {BANDS.map(b => m.byBand[b.id].length === 0 ? null : (
                    <div key={b.id} style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 11, color: b.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{b.label}</div>
                      {m.byBand[b.id].sort((x, y) => y.amount - x.amount).map(x => (
                        <div key={x.line.id} className="rev-band" style={{ fontSize: 13 }}>
                          <span style={{ color: D.sec, minWidth: 0 }}>{x.line.name}{x.continued ? ' · continues' : ''}</span>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(x.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </details>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: D.mut, marginTop: 8, lineHeight: 1.5 }}>
            Unsigned = verbal + pending decision. “Continues” marks a recurring line carried past its last
            scheduled month at its last amount. Lost lines are excluded.
          </div>
        </section>

        {/* ── ALL LINES ── */}
        <section className="rev-sec">
          <div className="rev-sec-hd"><h2>All lines</h2></div>
          <div style={{ display: 'grid', gap: 6 }}>
            {lines.map(l => {
              const sm = statusMeta(l.status);
              return (
                <button key={l.id} className="rev-card rev-tap" data-print="row" style={{ padding: '12px 14px' }} onClick={() => setEditLine(l)}>
                  <div className="rev-row">
                    <span style={{ fontWeight: 600 }}>{l.name}{l.product ? <span style={{ color: D.mut, fontWeight: 400 }}> · {l.product}</span> : null}</span>
                    <span className="rev-chip" style={{ background: `${sm.color}22`, color: sm.color }}>{sm.label}{l.recurring ? ' · recurring' : ''}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── INVESTMENTS ── */}
        <section className="rev-sec">
          <div className="rev-sec-hd">
            <h2>Investments</h2>
            <button className="rev-btn" onClick={() => setEditInv('new')}>+ Add investor</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {STATUSES.map(s => {
              const xs = invest.filter(x => x.status === s.id);
              if (!xs.length) return null;
              return (
                <span key={s.id} className="rev-chip" style={{ background: `${s.color}22`, color: s.color, fontSize: 12.5, padding: '5px 10px' }}>
                  {s.label}: {xs.length} · {usd(xs.reduce((a, x) => a + x.amount, 0))}
                </span>
              );
            })}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {invest.map(x => (
              <div key={x.id} className="rev-card" data-print="row" style={{ padding: 14 }}>
                <div className="rev-row">
                  <button className="rev-tap" style={{ flex: '1 1 180px' }} onClick={() => setEditInv(x)}>
                    <div style={{ fontWeight: 700 }}>{x.investor}</div>
                    <div style={{ fontSize: 13, color: D.sec, marginTop: 2 }}>{usd(x.amount)} · {x.instrument}</div>
                    {x.notes && <div style={{ fontSize: 12.5, color: D.mut, marginTop: 3 }}>{x.notes}</div>}
                  </button>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 6, flex: '1 1 260px' }}>
                    <label><span className="rev-lbl" style={{ margin: '0 0 4px' }}>Status</span>
                      <select className="rev-sel" value={x.status} onChange={e => quickInvest(x, { status: e.target.value as Status })}>
                        {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </label>
                    <label><span className="rev-lbl" style={{ margin: '0 0 4px' }}>Accredited</span>
                      <select className="rev-sel" value={x.accredited} onChange={e => quickInvest(x, { accredited: e.target.value as Accredited })}>
                        <option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {editLine && (
        <LineEditor
          line={editLine === 'new' ? null : editLine}
          rows={editLine === 'new' ? [] : rows.filter(r => r.line_id === editLine.id)}
          thisMonth={thisMonth}
          onClose={() => setEditLine(null)}
          onSaved={async () => { setEditLine(null); await load(); }}
        />
      )}
      {editInv && (
        <InvestEditor inv={editInv === 'new' ? null : editInv} onClose={() => setEditInv(null)} onSaved={async () => { setEditInv(null); await load(); }} />
      )}
      {editTarget && (
        <TargetEditor targets={targets} onClose={() => setEditTarget(false)} onSaved={async () => { setEditTarget(false); await load(); }} />
      )}
    </div>
  );
}

// ── Shared sheet ────────────────────────────────────────────────────────────
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <div className="rev-sheet-scrim" onClick={onClose} />
      <div className="rev-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="rev-row" style={{ alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{title}</div>
          <button className="rev-btn" onClick={onClose}>✕ Close</button>
        </div>
        {children}
      </div>
    </>
  );
}

// ── Edit a line and its schedule ────────────────────────────────────────────
function LineEditor({ line, rows, thisMonth, onClose, onSaved }: {
  line: Line | null; rows: Sched[]; thisMonth: string; onClose: () => void; onSaved: () => void;
}) {
  const sb = getCrmClient();
  const [f, setF] = useState({
    name: line?.name ?? '', product: line?.product ?? '', status: (line?.status ?? 'verbal') as Status,
    recurring: line?.recurring ?? false, decision_date: line?.decision_date ?? '',
    decision_note: line?.decision_note ?? '', next_action: line?.next_action ?? '', notes: line?.notes ?? '',
  });
  const [sched, setSched] = useState(
    [...rows].sort((a, b) => norm(a.month).localeCompare(norm(b.month)))
      .map(r => ({ month: norm(r.month).slice(0, 7), amount: String(r.amount) })),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }));

  function addMonthRow() {
    setSched(s => {
      const last = s.length ? `${s[s.length - 1].month}-01` : addMonths(thisMonth, -1);
      return [...s, { month: addMonths(last, 1).slice(0, 7), amount: s.length ? s[s.length - 1].amount : '' }];
    });
  }

  async function save() {
    setErr(null);
    if (!f.name.trim()) { setErr('Name is required.'); return; }
    const cleaned = sched.filter(r => r.month);
    const months = cleaned.map(r => r.month);
    if (new Set(months).size !== months.length) { setErr('Each month can appear only once in the schedule.'); return; }
    const bad = cleaned.find(r => r.amount === '' || !Number.isFinite(Number(r.amount)) || Number(r.amount) < 0);
    if (bad) { setErr(`Amount for ${bad.month} must be a number of 0 or more.`); return; }
    setBusy(true);
    try {
      const payload = {
        name: f.name.trim(), product: f.product.trim() || null, status: f.status, recurring: f.recurring,
        decision_date: f.decision_date || null, decision_note: f.decision_note.trim() || null,
        next_action: f.next_action.trim() || null, notes: f.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };
      let id = line?.id;
      if (id) {
        const { error } = await sb.from('crm_revenue_lines').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from('crm_revenue_lines').insert(payload).select('id').single();
        if (error) throw error;
        id = (data as { id: string }).id;
      }
      const finalMonths = cleaned.map(r => `${r.month}-01`);
      const stale = rows.filter(r => !finalMonths.includes(norm(r.month))).map(r => r.id);
      if (stale.length) {
        const { error } = await sb.from('crm_revenue_schedule').delete().in('id', stale);
        if (error) throw error;
      }
      if (cleaned.length) {
        const { error } = await sb.from('crm_revenue_schedule').upsert(
          cleaned.map(r => ({ line_id: id, month: `${r.month}-01`, amount: Number(r.amount) })),
          { onConflict: 'line_id,month' },
        );
        if (error) throw error;
      }
      onSaved();
    } catch (e) {
      setErr((e as { message?: string })?.message ?? String(e));
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!line || !window.confirm(`Delete “${line.name}” and its whole schedule?`)) return;
    setBusy(true);
    const { error } = await sb.from('crm_revenue_lines').delete().eq('id', line.id);
    setBusy(false);
    if (error) setErr(error.message); else onSaved();
  }

  return (
    <Sheet title={line ? `Edit — ${line.name}` : 'New line'} onClose={onClose}>
      <label className="rev-lbl" htmlFor="rl-name">Name</label>
      <input id="rl-name" className="rev-in" value={f.name} onChange={e => set('name', e.target.value)} />
      <label className="rev-lbl" htmlFor="rl-status">Status</label>
      <select id="rl-status" className="rev-sel" value={f.status} onChange={e => set('status', e.target.value as Status)}>
        {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <label className="rev-lbl" htmlFor="rl-product">Product</label>
      <input id="rl-product" className="rev-in" value={f.product} onChange={e => set('product', e.target.value)} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, minHeight: 40, fontSize: 14.5 }}>
        <input type="checkbox" checked={f.recurring} onChange={e => set('recurring', e.target.checked)} style={{ width: 22, height: 22 }} />
        Recurring — continues after the last scheduled month
      </label>
      <label className="rev-lbl" htmlFor="rl-dd">Decision date</label>
      <input id="rl-dd" type="date" className="rev-in" value={f.decision_date} onChange={e => set('decision_date', e.target.value)} />
      <label className="rev-lbl" htmlFor="rl-dn">Decision note</label>
      <textarea id="rl-dn" className="rev-ta" value={f.decision_note} onChange={e => set('decision_note', e.target.value)} />
      <label className="rev-lbl" htmlFor="rl-na">Next action</label>
      <input id="rl-na" className="rev-in" value={f.next_action} onChange={e => set('next_action', e.target.value)} />
      <label className="rev-lbl" htmlFor="rl-notes">Notes</label>
      <textarea id="rl-notes" className="rev-ta" value={f.notes} onChange={e => set('notes', e.target.value)} />

      <div className="rev-lbl" style={{ marginTop: 18 }}>Schedule — what arrives when</div>
      {sched.length === 0 && <div style={{ fontSize: 13, color: D.mut, marginBottom: 6 }}>No months scheduled.</div>}
      {sched.map((r, i) => (
        <div key={i} className="rev-sched">
          <input type="month" className="rev-in" aria-label={`Month ${i + 1}`} value={r.month}
            onChange={e => setSched(s => s.map((x, j) => (j === i ? { ...x, month: e.target.value } : x)))} />
          <input className="rev-in" inputMode="decimal" aria-label={`Amount for month ${i + 1}`} placeholder="Amount" value={r.amount}
            onChange={e => setSched(s => s.map((x, j) => (j === i ? { ...x, amount: e.target.value.replace(/[^0-9.]/g, '') } : x)))} />
          <button className="rev-btn" aria-label={`Remove month ${i + 1}`} onClick={() => setSched(s => s.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="rev-btn" onClick={addMonthRow} style={{ marginTop: 4 }}>+ Add month</button>

      {err && <div className="rev-err" role="alert">{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        <button className="rev-btn pri" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        <button className="rev-btn" disabled={busy} onClick={onClose}>Cancel</button>
        {line && <button className="rev-btn dng" disabled={busy} onClick={remove} style={{ marginLeft: 'auto' }}>Delete line</button>}
      </div>
    </Sheet>
  );
}

// ── Edit an investment ──────────────────────────────────────────────────────
function InvestEditor({ inv, onClose, onSaved }: { inv: Invest | null; onClose: () => void; onSaved: () => void }) {
  const sb = getCrmClient();
  const [f, setF] = useState({
    investor: inv?.investor ?? '', amount: inv ? String(inv.amount) : '', instrument: inv?.instrument ?? 'SAFE',
    status: (inv?.status ?? 'verbal') as Status, accredited: (inv?.accredited ?? 'unknown') as Accredited, notes: inv?.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    if (!f.investor.trim()) { setErr('Investor is required.'); return; }
    if (f.amount === '' || !Number.isFinite(Number(f.amount)) || Number(f.amount) < 0) { setErr('Amount must be a number of 0 or more.'); return; }
    setBusy(true);
    const payload = {
      investor: f.investor.trim(), amount: Number(f.amount), instrument: f.instrument.trim() || 'SAFE',
      status: f.status, accredited: f.accredited, notes: f.notes.trim() || null, updated_at: new Date().toISOString(),
    };
    const { error } = inv
      ? await sb.from('crm_investments').update(payload).eq('id', inv.id)
      : await sb.from('crm_investments').insert(payload);
    setBusy(false);
    if (error) setErr(error.message); else onSaved();
  }
  async function remove() {
    if (!inv || !window.confirm(`Delete investment from “${inv.investor}”?`)) return;
    const { error } = await sb.from('crm_investments').delete().eq('id', inv.id);
    if (error) setErr(error.message); else onSaved();
  }

  return (
    <Sheet title={inv ? `Edit — ${inv.investor}` : 'New investment'} onClose={onClose}>
      <label className="rev-lbl" htmlFor="iv-name">Investor</label>
      <input id="iv-name" className="rev-in" value={f.investor} onChange={e => setF({ ...f, investor: e.target.value })} />
      <label className="rev-lbl" htmlFor="iv-amt">Amount</label>
      <input id="iv-amt" className="rev-in" inputMode="decimal" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value.replace(/[^0-9.]/g, '') })} />
      <label className="rev-lbl" htmlFor="iv-ins">Instrument</label>
      <input id="iv-ins" className="rev-in" value={f.instrument} onChange={e => setF({ ...f, instrument: e.target.value })} />
      <label className="rev-lbl" htmlFor="iv-st">Status</label>
      <select id="iv-st" className="rev-sel" value={f.status} onChange={e => setF({ ...f, status: e.target.value as Status })}>
        {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <label className="rev-lbl" htmlFor="iv-acc">Accredited</label>
      <select id="iv-acc" className="rev-sel" value={f.accredited} onChange={e => setF({ ...f, accredited: e.target.value as Accredited })}>
        <option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option>
      </select>
      <label className="rev-lbl" htmlFor="iv-notes">Notes</label>
      <textarea id="iv-notes" className="rev-ta" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
      {err && <div className="rev-err" role="alert">{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        <button className="rev-btn pri" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        <button className="rev-btn" disabled={busy} onClick={onClose}>Cancel</button>
        {inv && <button className="rev-btn dng" disabled={busy} onClick={remove} style={{ marginLeft: 'auto' }}>Delete</button>}
      </div>
    </Sheet>
  );
}

// ── Edit the target ─────────────────────────────────────────────────────────
// One standing monthly target. The optional date is the month Jeff means to hit
// it; left empty, the target stands with no date — which is how it was seeded,
// because he has not said when.
function TargetEditor({ targets, onClose, onSaved }: { targets: Target[]; onClose: () => void; onSaved: () => void }) {
  const sb = getCrmClient();
  const standing = targets.find(t => !t.month) ?? null;
  const dated = targets.filter(t => t.month).sort((a, b) => (a.month! < b.month! ? -1 : 1))[0] ?? null;
  const current = dated ?? standing;
  const [amount, setAmount] = useState(current ? String(current.target_amount) : '10000');
  const [month, setMonth] = useState(dated?.month ? norm(dated.month).slice(0, 7) : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    if (amount === '' || !Number.isFinite(Number(amount)) || Number(amount) < 0) { setErr('Target must be a number of 0 or more.'); return; }
    setBusy(true);
    try {
      const row = { month: month ? `${month}-01` : null, target_amount: Number(amount), updated_at: new Date().toISOString() };
      if (current) {
        const { error } = await sb.from('crm_revenue_targets').update(row).eq('id', current.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('crm_revenue_targets').insert(row);
        if (error) throw error;
      }
      onSaved();
    } catch (e) {
      setErr((e as { message?: string })?.message ?? String(e));
    } finally { setBusy(false); }
  }

  return (
    <Sheet title="Monthly target" onClose={onClose}>
      <label className="rev-lbl" htmlFor="tg-amt">Target per month</label>
      <input id="tg-amt" className="rev-in" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
      <label className="rev-lbl" htmlFor="tg-m">Target date (month) — optional</label>
      <input id="tg-m" type="month" className="rev-in" value={month} onChange={e => setMonth(e.target.value)} />
      <div style={{ fontSize: 12.5, color: D.mut, marginTop: 6 }}>Leave empty to keep a standing target with no date.</div>
      {err && <div className="rev-err" role="alert">{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button className="rev-btn pri" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        <button className="rev-btn" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}
