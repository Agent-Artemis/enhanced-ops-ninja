'use client';

import { useState } from 'react';

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

export function SocialView() {
  const [platform, setPlatform] = useState('linkedin');
  const active = PLATFORMS.find(p => p.id === platform)!;

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
              padding: '16px 22px', borderRadius: 10, textDecoration: 'none',
              background: l.primary ? '#1A6BF9' : '#1A1A1A',
              border: l.primary ? 'none' : '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontSize: 14, fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            {l.label}
            <span style={{ fontSize: 12, opacity: 0.6 }}>↗</span>
          </a>
        ))}
      </div>

      {/* Approval workflow */}
      <div style={{
        background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10, padding: '20px 24px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>
          How the pipeline works
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
        Posts are drafted in the Content Calendar. Flip a row to APPROVED and Artemis handles the rest.
      </div>
    </div>
  );
}
