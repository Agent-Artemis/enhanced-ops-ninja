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
      height: 56, background: '#0A0A0A',
      borderBottom: '1px solid rgba(26,110,204,0.25)',
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
        <span style={{ fontSize: 22 }}>🥷</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1A6ECC', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
          Ninja CRM
        </span>
      </div>

      <nav style={{ display: 'flex', gap: 4 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onViewChange(t.id)}
            style={{
              padding: '5px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: view === t.id ? '#1A6ECC' : 'transparent',
              color: view === t.id ? '#fff' : '#94A3B8',
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
          padding: '6px 16px', background: '#1A6ECC', color: '#fff',
          border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        + New Card
      </button>
    </header>
  );
}
