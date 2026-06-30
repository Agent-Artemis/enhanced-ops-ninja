'use client';

import Image from 'next/image';
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
      height: 56, background: '#1A1A1A',
      borderBottom: '1px solid #2d2d2d',
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 20,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <Image src="/logo-dark.png" alt="Ninja CRM" width={100} height={28} style={{ objectFit: 'contain' }} />
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#1A6BF9',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          CRM
        </span>
      </div>

      {/* View tabs */}
      <nav style={{ display: 'flex', gap: 4 }}>
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
          cursor: 'pointer', transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        + New Card
      </button>
    </header>
  );
}
