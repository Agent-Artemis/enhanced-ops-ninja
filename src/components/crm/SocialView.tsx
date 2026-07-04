'use client';

import { useState } from 'react';
import type { Contact, LeadStatus } from '@/lib/crm/types';
import { linkedinOf, pendingBookingOf } from '@/lib/crm/types';
import { setLeadStatus } from '@/lib/crm/data';

const CONTENT_CALENDAR_URL =
  'https://docs.google.com/spreadsheets/d/17xf0GmuVqj1_7DEPAWnLyK6Uf-q4iSk57z2hOvwEVzM/edit';
const DM_BOOKING_URL = 'https://cal.com/enhancedopsninja/30-min';
const OPS_REVIEW_URL = 'https://cal.com/enhancedopsninja/45-min';

interface Platform {
  id: string;
  name: string;
  live: boolean;
  links: { label: string; url: string; primary?: boolean }[];
}

const PLATFORMS: Platform[] = [
  {
    id: 'linkedin',
    name: 'LinkedIn',
    live: true,
    links: [
      { label: 'Content Calendar', url: CONTENT_CALENDAR_URL, primary: true },
      { label: 'DM Booking Link (30-min)', url: DM_BOOKING_URL },
      { label: 'Ops Review Link (45-min)', url: OPS_REVIEW_URL },
      { label: 'LinkedIn Feed', url: 'https://www.linkedin.com/feed/' },
      { label: 'Sales Navigator', url: 'https://www.linkedin.com/sales/' },
    ],
  },
  { id: 'facebook',  name: 'Facebook',  live: false, links: [] },
  { id: 'instagram', name: 'Instagram', live: false, links: [] },
  { id: 'x',         name: 'X / Twitter', live: false, links: [] },
];

const WORKFLOW_STEPS = [
  { status: 'DRAFT',    color: '#9ca3af', desc: 'Artemis writes the post into the calendar' },
  { status: 'APPROVED', color: '#1A6BF9', desc: 'You change Status to APPROVED in the sheet' },
  { status: 'POSTED',   color: '#22c55e', desc: 'Artemis publishes it and links the live post' },
];

const LEAD_STATUSES: { id: LeadStatus; label: string; color: string }[] = [
  { id: 'new',      label: 'New',      color: '#9ca3af' },
  { id: 'invited',  label: 'Invited',  color: '#6B9CF9' },
  { id: 'messaged', label: 'Messaged', color: '#a78bfa' },
  { id: 'replied',  label: 'Replied',  color: '#fbbf24' },
  { id: 'booked',   label: 'Booked',   color: '#22c55e' },
  { id: 'skipped',  label: 'Skipped',  color: '#4b5563' },
];

interface Props {
  contacts: Contact[];
  onRefresh: () => void;
}

export function SocialView({ contacts, onRefresh }: Props) {
  const [platform, setPlatform] = useState('linkedin');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const active = PLATFORMS.find(p => p.id === platform)!;

  const leads = contacts
    .map(c => ({ contact: c, li: linkedinOf(c) }))
    .filter((x): x is { contact: Contact; li: NonNullable<ReturnType<typeof linkedinOf>> } => x.li !== null);

  const counts: Record<string, number> = {};
  for (const { li } of leads) counts[li.status] = (counts[li.status] ?? 0) + 1;
  const booked = leads.filter(({ contact, li }) =>
    li.status === 'booked' || pendingBookingOf(contact)?.source === 'linkedin-dm').length;

  const shown = statusFilter === 'all' ? leads : leads.filter(({ li }) => li.status === statusFilter);

  async function changeStatus(contact: Contact, status: string) {
    setBusy(contact.id);
    try { await setLeadStatus(contact, status); onRefresh(); } finally { setBusy(null); }
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Platform selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            onClick={() => p.live && setPlatform(p.id)}
            style={{
              padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500,
              border: 'none', cursor: p.live ? 'pointer' : 'default', transition: 'all 0.15s',
              background: platform === p.id ? '#1A6BF9' : 'rgba(255,255,255,0.06)',
              color: platform === p.id ? '#fff' : p.live ? '#d1d5db' : '#4b5563',
            }}
          >
            {p.name}
            {!p.live && <span style={{ marginLeft: 6, fontSize: 10, color: '#4b5563' }}>soon</span>}
          </button>
        ))}
      </div>

      {/* Quick links */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
        {active.links.map(l => (
          <a
            key={l.label}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 20px', borderRadius: 10, textDecoration: 'none',
              background: l.primary ? '#1A6BF9' : '#1A1A1A',
              border: l.primary ? 'none' : '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            {l.label}
            <span style={{ fontSize: 12, opacity: 0.6 }}>↗</span>
          </a>
        ))}
      </div>

      {/* ── Outreach funnel ─────────────────────────────────────────────── */}
      <div style={{
        background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10, padding: '20px 24px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>LinkedIn Outreach</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 12, color: '#6b7280' }}>{leads.length} leads total</div>
        </div>

        {/* Funnel tiles */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          {LEAD_STATUSES.filter(s => s.id !== 'skipped').map(s => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(statusFilter === s.id ? 'all' : s.id)}
              style={{
                flex: '1 1 100px', background: 'rgba(255,255,255,0.04)',
                border: statusFilter === s.id ? `1px solid ${s.color}` : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '12px 10px', cursor: 'pointer', textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>
                {s.id === 'booked' ? booked : (counts[s.id] ?? 0)}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </button>
          ))}
        </div>

        {/* Lead list */}
        {shown.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b7280', padding: '8px 0' }}>
            {leads.length === 0
              ? 'No leads yet — Artemis loads decision-makers here from Sales Navigator.'
              : 'No leads with this status.'}
          </div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {shown.map(({ contact, li }) => {
              const meta = LEAD_STATUSES.find(s => s.id === li.status);
              const name = `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim();
              return (
                <div key={contact.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '9px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ flex: '0 0 180px', fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </div>
                  <div style={{ flex: 1, fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[li.title, li.company].filter(Boolean).join(' @ ')}
                  </div>
                  <a href={li.profile_url} target="_blank" rel="noopener noreferrer"
                     style={{ fontSize: 12, color: '#6B9CF9', textDecoration: 'none', flexShrink: 0 }}>
                    Profile ↗
                  </a>
                  <select
                    value={li.status}
                    disabled={busy === contact.id}
                    onChange={e => changeStatus(contact, e.target.value)}
                    style={{
                      background: 'rgba(255,255,255,0.06)', color: meta?.color ?? '#d1d5db',
                      border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
                      fontSize: 12, fontWeight: 700, padding: '3px 6px', flexShrink: 0,
                    }}
                  >
                    {LEAD_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Content pipeline */}
      <div style={{
        background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10, padding: '20px 24px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>
          Content pipeline
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {WORKFLOW_STEPS.map(s => (
            <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                background: `${s.color}33`, color: s.color, borderRadius: 10,
                padding: '2px 10px', fontSize: 11, fontWeight: 700, minWidth: 72, textAlign: 'center',
              }}>
                {s.status}
              </span>
              <span style={{ fontSize: 13, color: '#9ca3af' }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#6b7280' }}>
        Posts are drafted in the Content Calendar. DM leads land above via Sales Navigator; a booked
        30-min automatically marks the lead converted and queues a card in Bookings.
      </div>
    </div>
  );
}
