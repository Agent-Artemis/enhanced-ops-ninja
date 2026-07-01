'use client';

import type { CrmView } from '@/lib/crm/types';

interface Props {
  view: CrmView;
  onViewChange: (v: CrmView) => void;
  onNewCard: () => void;
}

const TABS: { id: CrmView; label: string }[] = [
  { id: 'onecard', label: 'One Card' },
  { id: 'kanban',  label: 'Kanban' },
  { id: 'list',    label: 'List' },
];

export function CrmShell({ view, onViewChange, onNewCard }: Props) {
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

      <nav style={{ display: 'flex', gap: 4, marginLeft: 32 }}>
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
