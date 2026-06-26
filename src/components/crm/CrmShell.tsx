'use client';

import Link from 'next/link';
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
    <header className="fixed top-0 left-0 right-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center px-6 gap-6">
      <span className="text-lg font-bold text-[#1A6ECC] shrink-0">EON CRM</span>

      <nav className="flex gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onViewChange(t.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === t.id
                ? 'bg-[#1A6ECC] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1" />

      <Link
        href="/crm/voice-agents"
        className="text-sm text-slate-600 hover:text-[#1A6ECC] transition-colors"
      >
        AI Voice Agents
      </Link>

      <button
        onClick={onNewCard}
        className="px-4 py-1.5 bg-[#1A6ECC] text-white text-sm font-medium rounded-md hover:bg-[#155fb3] transition-colors"
      >
        + New Card
      </button>
    </header>
  );
}
