'use client';

import type { CrmView } from '@/lib/crm/types';

interface Props {
  view: CrmView;
  onViewChange: (v: CrmView) => void;
  onNewCard: () => void;
  bookingsCount?: number;
  onToggleBookings?: () => void;
}

const TABS: { id: CrmView; label: string }[] = [
  { id: 'onecard', label: 'One Card' },
  { id: 'kanban',  label: 'Kanban' },
  { id: 'list',    label: 'List' },
  { id: 'social',  label: 'Social' },
];

export function CrmShell({ view, onViewChange, onNewCard, bookingsCount = 0, onToggleBookings }: Props) {
  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
      height: 88, background: '#1A1A1A',
      borderBottom: '2px solid #1A6BF9',
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 20,
    }}>
      {/* Logo only — no text */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-dark.png" alt="EnhancedOps.ninja" style={{ height: 72, width: 'auto', objectFit: 'contain' }} />
      </div>

      <nav style={{ display: 'flex', gap: 4, marginLeft: 32, alignItems: 'center' }}>
        <a
          href="https://dojo.enhancedops.ninja"
          style={{
            padding: '5px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500,
            border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
            background: 'transparent', color: '#9ca3af',
            textDecoration: 'none', marginRight: 8,
          }}
        >
          ← Dojo
        </a>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onViewChange(t.id)}
            style={{
              padding: '5px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: view === t.id ? '#1A6BF9' : 'transparent',
              color: view === t.id ? '#fff' : '#9ca3af',
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {onToggleBookings && (
        <button
          onClick={onToggleBookings}
          style={{
            padding: '6px 14px', background: 'transparent', color: '#d1d5db',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          Bookings
          {bookingsCount > 0 && (
            <span style={{
              background: 'rgba(26,107,249,0.25)', color: '#6B9CF9',
              borderRadius: 10, padding: '1px 6px', fontWeight: 700, fontSize: 12,
            }}>
              {bookingsCount}
            </span>
          )}
        </button>
      )}

      <button
        onClick={onNewCard}
        style={{
          padding: '6px 16px', background: '#1A6BF9', color: '#fff',
          border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        + New Card
      </button>
    </header>
  );
}
