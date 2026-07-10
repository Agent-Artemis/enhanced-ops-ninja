'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCrmClient } from '@/lib/crm/client';
import { ACTIVITY_PLATFORMS, platformLabel } from '@/lib/crm/types';
import { DailyActivityLog } from './DailyActivityLog';

// ── Types matching /api/crm/reports response ────────────────────────────────────
interface ReportData {
  range: { fromISO: string; toISO: string; days: number };
  outreach: { total: number; byPlatform: Record<string, number> };
  meetings: { total: number; byOutcome: Record<string, number>; calcomBookedInRange: number };
  linkedin: { byStatus: Record<string, number> };
  pipeline: {
    signedClients: number;
    activeClients: number;
    confirmedMRR: number;
    weightedMRR: number;
    weightedUpfront: number;
    avgDealMRR: number | null;
  };
}

const D = {
  bg: '#1A1A1A', card: '#1A1A1A', panel: '#111111', border: '#2d2d2d',
  text: '#FFFFFF', textSec: '#9ca3af', textMut: '#6b7280', faint: '#4b5563',
  blue: '#1A6BF9', green: '#16a34a', sky: '#0ea5e9', violet: '#8b5cf6', amber: '#f59e0b',
};

const RANGES = [
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
  { days: 180, label: '180d' },
  { days: 365, label: '365d' },
];

function fmtUsd(n: number) { return '$' + Math.round(n).toLocaleString(); }
function fmtNum(n: number) { return Math.round(n).toLocaleString(); }
function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }

async function authedFetch(days: number): Promise<ReportData> {
  const client = getCrmClient();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`/api/crm/reports?days=${days}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Reports request failed (${res.status})`);
  return res.json();
}

// ── Small UI pieces ─────────────────────────────────────────────────────────────
function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: '18px 22px', flex: '1 1 180px', minWidth: 0 }}>
      <div style={{ color: D.textMut, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{label}</div>
      <div style={{ color, fontSize: 30, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: D.faint, fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: '20px 24px' }}>
      <h3 style={{ color: D.text, fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>{title}</h3>
      {note && <p style={{ color: D.textMut, fontSize: 12, margin: '0 0 16px' }}>{note}</p>}
      {!note && <div style={{ height: 12 }} />}
      {children}
    </div>
  );
}

function labeledInput(label: string, value: string, onChange: (v: string) => void, opts?: { prefix?: string; suffix?: string }) {
  return (
    <div style={{ flex: '1 1 150px' }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: D.textSec, marginBottom: 5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', background: '#0f1117', border: `1px solid #374151`, borderRadius: 8 }}>
        {opts?.prefix && <span style={{ color: D.textMut, fontSize: 14, paddingLeft: 12 }}>{opts.prefix}</span>}
        <input
          type="number" value={value} onChange={e => onChange(e.target.value)} min={0}
          style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: D.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
        />
        {opts?.suffix && <span style={{ color: D.textMut, fontSize: 14, paddingRight: 12 }}>{opts.suffix}</span>}
      </div>
    </div>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────────
export function ReportsView() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Reverse-model inputs
  const [targetClients, setTargetClients] = useState('5');
  const [targetMRR, setTargetMRR] = useState('');
  const [meetingRatePct, setMeetingRatePct] = useState('');   // % of outreach → meeting
  const [closeRatePct, setCloseRatePct] = useState('25');     // % of meetings → signed client
  const [avgMrrInput, setAvgMrrInput] = useState('');

  const load = useCallback(async (d: number) => {
    setLoading(true); setError('');
    try { setData(await authedFetch(d)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load reports'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  // Seed meeting-rate default from actuals once data lands (only if user hasn't typed one)
  useEffect(() => {
    if (data && meetingRatePct === '' && data.outreach.total > 0) {
      setMeetingRatePct(((data.meetings.total / data.outreach.total) * 100).toFixed(1));
    }
  }, [data, meetingRatePct]);

  // Seed avg MRR/client default from actuals once data lands (only if user hasn't typed one)
  useEffect(() => {
    if (data && avgMrrInput === '' && data.pipeline.avgDealMRR != null && data.pipeline.avgDealMRR > 0) {
      setAvgMrrInput(String(Math.round(data.pipeline.avgDealMRR)));
    }
  }, [data, avgMrrInput]);

  const platformRows = useMemo(() => {
    if (!data) return [];
    const entries = ACTIVITY_PLATFORMS
      .map(p => ({ id: p.id, label: p.label, count: data.outreach.byPlatform[p.id] ?? 0 }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count);
    return entries;
  }, [data]);

  // Reverse model math
  const model = useMemo(() => {
    const meetingRate = Math.max(0.001, (Number(meetingRatePct) || 0) / 100);
    const closeRate = Math.max(0.001, (Number(closeRatePct) || 0) / 100);
    const typedAvg = Number(avgMrrInput);
    const avgDeal = typedAvg > 0 ? typedAvg : (data?.pipeline.avgDealMRR ?? null);
    const clientsFromMRR = avgDeal && Number(targetMRR) > 0 ? Number(targetMRR) / avgDeal : 0;
    const driverClients = Math.max(Number(targetClients) || 0, clientsFromMRR);
    const requiredMeetings = driverClients / closeRate;
    const requiredOutreach = requiredMeetings / meetingRate;
    return { meetingRate, closeRate, avgDeal, clientsFromMRR, driverClients, requiredMeetings, requiredOutreach };
  }, [data, targetClients, targetMRR, meetingRatePct, closeRatePct, avgMrrInput]);

  // Split required outreach across platforms using the historical mix (fallback: LinkedIn)
  const outreachMix = useMemo(() => {
    if (!data || model.requiredOutreach <= 0) return [];
    const total = data.outreach.total;
    const base = total > 0
      ? platformRows.map(r => ({ id: r.id, label: r.label, share: r.count / total }))
      : [{ id: 'linkedin', label: 'LinkedIn', share: 1 }];
    return base.map(b => ({ ...b, count: Math.ceil(model.requiredOutreach * b.share) }));
  }, [data, model.requiredOutreach, platformRows]);

  const maxPlatform = Math.max(1, ...platformRows.map(r => r.count));

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 24px 80px' }}>
      {/* Manual daily activity log — independent of the auto-metrics report below */}
      <DailyActivityLog />

      {/* Header + range */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ color: D.text, fontSize: 22, fontWeight: 700, margin: 0 }}>Activity &amp; Revenue Reports</h1>
          <p style={{ color: D.textMut, fontSize: 13, margin: '4px 0 0' }}>Outreach in, meetings held, and what it takes to hit your number.</p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: D.panel, border: `1px solid ${D.border}`, borderRadius: 8, padding: 4 }}>
          {RANGES.map(r => (
            <button key={r.days} onClick={() => setDays(r.days)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: days === r.days ? D.blue : 'transparent', color: days === r.days ? '#fff' : D.textSec }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ color: D.textMut, padding: 60, textAlign: 'center' }}>Loading reports…</div>}
      {error && !loading && (
        <div style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '14px 16px', fontSize: 13 }}>
          {error}
          <div style={{ color: D.textMut, marginTop: 6 }}>If the activity table isn&apos;t created yet, the outreach/meeting numbers will read zero until it is.</div>
        </div>
      )}

      {data && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* KPIs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <Kpi label="Outreach" value={fmtNum(data.outreach.total)} sub={`last ${days} days`} color={D.blue} />
            <Kpi label="Meetings" value={fmtNum(data.meetings.total)} sub={`${data.meetings.calcomBookedInRange} booked via Cal.com`} color={D.sky} />
            <Kpi label="Signed Clients" value={fmtNum(data.pipeline.signedClients)} sub={`${data.pipeline.activeClients} active missions`} color={D.green} />
            <Kpi label="Confirmed MRR" value={fmtUsd(data.pipeline.confirmedMRR)} sub={data.pipeline.avgDealMRR ? `${fmtUsd(data.pipeline.avgDealMRR)} avg / client` : 'no active deals yet'} color={D.violet} />
          </div>

          {/* Outreach per platform */}
          <Section title="Outreach by Platform" note={`${fmtNum(data.outreach.total)} logged touches in the last ${days} days`}>
            {platformRows.length === 0 ? (
              <p style={{ color: D.textMut, fontSize: 13, fontStyle: 'italic', margin: 0 }}>No outreach logged yet in this window. Log texts, calls, and DMs from a card or the quick-log button.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {platformRows.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 92, color: D.textSec, fontSize: 13, flexShrink: 0 }}>{r.label}</div>
                    <div style={{ flex: 1, background: D.panel, borderRadius: 6, height: 24, overflow: 'hidden' }}>
                      <div style={{ width: `${(r.count / maxPlatform) * 100}%`, height: '100%', background: D.blue, borderRadius: 6, minWidth: 2 }} />
                    </div>
                    <div style={{ width: 44, textAlign: 'right', color: D.text, fontSize: 13, fontWeight: 600 }}>{fmtNum(r.count)}</div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Funnel */}
          <Section title="Conversion Funnel" note="Logged outreach → meetings → signed clients. Early on these ratios are noisy — they sharpen as you log.">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' }}>
              {[
                { label: 'Outreach', value: data.outreach.total, color: D.blue },
                { label: 'Meetings', value: data.meetings.total, color: D.sky, conv: data.outreach.total > 0 ? data.meetings.total / data.outreach.total : null },
                { label: 'Signed Clients', value: data.pipeline.signedClients, color: D.green, conv: data.meetings.total > 0 ? data.pipeline.signedClients / data.meetings.total : null },
              ].map(step => (
                <div key={step.label} style={{ flex: '1 1 150px', background: D.panel, border: `1px solid ${D.border}`, borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ color: D.textMut, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{step.label}</div>
                  <div style={{ color: step.color, fontSize: 26, fontWeight: 700, marginTop: 6 }}>{fmtNum(step.value)}</div>
                  {step.conv != null && <div style={{ color: D.textSec, fontSize: 12, marginTop: 4 }}>{pct(step.conv)} from prior</div>}
                </div>
              ))}
            </div>
          </Section>

          {/* Reverse model */}
          <Section title="Reverse Model — What activity hits your number?" note="Set a target, tune the conversion rates, and see the outreach volume required.">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
              {labeledInput('Target New Clients', targetClients, setTargetClients)}
              {labeledInput('Target New MRR', targetMRR, setTargetMRR, { prefix: '$' })}
              {labeledInput('Avg MRR / Client', avgMrrInput, setAvgMrrInput, { prefix: '$' })}
              {labeledInput('Outreach → Meeting', meetingRatePct, setMeetingRatePct, { suffix: '%' })}
              {labeledInput('Meeting → Client', closeRatePct, setCloseRatePct, { suffix: '%' })}
            </div>

            {model.avgDeal && Number(targetMRR) > 0 && (
              <p style={{ color: D.textSec, fontSize: 12, margin: '0 0 14px' }}>
                At {fmtUsd(model.avgDeal)} avg MRR/client, {fmtUsd(Number(targetMRR))} MRR needs ~{fmtNum(Math.ceil(model.clientsFromMRR))} clients.
                Driving off the larger target: <strong style={{ color: D.text }}>{fmtNum(Math.ceil(model.driverClients))} clients</strong>.
              </p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: '1 1 160px', background: '#0f1117', border: `1px solid ${D.blue}55`, borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ color: D.textMut, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Outreach Needed</div>
                <div style={{ color: D.blue, fontSize: 28, fontWeight: 700, marginTop: 6 }}>{fmtNum(Math.ceil(model.requiredOutreach))}</div>
              </div>
              <div style={{ flex: '1 1 160px', background: '#0f1117', border: `1px solid ${D.sky}55`, borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ color: D.textMut, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Meetings Needed</div>
                <div style={{ color: D.sky, fontSize: 28, fontWeight: 700, marginTop: 6 }}>{fmtNum(Math.ceil(model.requiredMeetings))}</div>
              </div>
              <div style={{ flex: '1 1 160px', background: '#0f1117', border: `1px solid ${D.green}55`, borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ color: D.textMut, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Clients Target</div>
                <div style={{ color: D.green, fontSize: 28, fontWeight: 700, marginTop: 6 }}>{fmtNum(Math.ceil(model.driverClients))}</div>
              </div>
            </div>

            {outreachMix.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ color: D.textSec, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                  Outreach split {data.outreach.total > 0 ? '(at your current platform mix)' : '(no history yet — shown as LinkedIn)'}:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {outreachMix.map(m => (
                    <span key={m.id} style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 999, padding: '5px 12px', fontSize: 12, color: D.textSec }}>
                      {platformLabel(m.id)}: <strong style={{ color: D.text }}>{fmtNum(m.count)}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
