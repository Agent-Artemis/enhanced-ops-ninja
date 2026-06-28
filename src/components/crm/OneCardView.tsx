'use client';

import { useState } from 'react';
import type { Contact, Stage } from '@/lib/crm/types';
import { ContactCard } from './ContactCard';
import { fileUnderDate, pullToActive, sendToAlpha } from '@/lib/crm/data';
import {
  todayStack, dayTabs, monthTabs, alphaGroups,
  contactsForDay, contactsForMonth,
} from '@/lib/crm/filing';

interface Props {
  contacts: Contact[];
  stages: Stage[];
  onOpen: (c: Contact) => void;
  onRefresh: () => Promise<void>;
}

type Panel = 'today' | { day: number } | { month: string; year: number } | 'alpha';

export function OneCardView({ contacts, stages, onOpen, onRefresh }: Props) {
  const [panel, setPanel] = useState<Panel>('today');

  const todayCards  = todayStack(contacts);
  const days        = dayTabs(contacts);
  const months      = monthTabs(contacts);
  const alphaMap    = alphaGroups(contacts);
  const activeCards = contacts.filter(c => c.is_active && !c.next_action_date);

  function snooze(contact: Contact, days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const dateStr = d.toISOString().slice(0, 10);
    fileUnderDate(contact.id, dateStr).then(onRefresh);
  }

  function snoozeWeek(contact: Contact) { snooze(contact, 7); }
  function snoozeDay(contact: Contact)  { snooze(contact, 1); }

  function toAlpha(contact: Contact) {
    sendToAlpha(contact.id).then(onRefresh);
  }

  function toActive(contact: Contact) {
    pullToActive(contact.id).then(onRefresh);
  }

  function snoozeActions(contact: Contact) {
    return (
      <div className="flex gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
        <button onClick={() => snoozeDay(contact)}
          className="text-xs px-2 py-0.5 border border-slate-300 rounded hover:bg-slate-50">
          +1d
        </button>
        <button onClick={() => snoozeWeek(contact)}
          className="text-xs px-2 py-0.5 border border-slate-300 rounded hover:bg-slate-50">
          +1wk
        </button>
        <button onClick={() => toAlpha(contact)}
          className="text-xs px-2 py-0.5 border border-slate-300 rounded hover:bg-slate-50">
          A–Z
        </button>
        <button onClick={() => toActive(contact)}
          className="text-xs px-2 py-0.5 border border-slate-300 rounded hover:bg-blue-50 text-[#1A6ECC]">
          ★ active
        </button>
      </div>
    );
  }

  function getCards(): Contact[] {
    if (panel === 'today') return todayCards;
    if (panel === 'alpha') return [];
    if (typeof panel === 'object' && 'day' in panel) return contactsForDay(contacts, panel.day);
    if (typeof panel === 'object' && 'month' in panel) return contactsForMonth(contacts, panel.month, panel.year);
    return [];
  }

  const panelCards = getCards();
  const isAlpha = panel === 'alpha';

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left sidebar — tickler file */}
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 overflow-y-auto flex flex-col">
        {/* TODAY */}
        <button
          onClick={() => setPanel('today')}
          className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 text-sm font-semibold transition-colors ${
            panel === 'today' ? 'bg-[#1A6ECC] text-white' : 'hover:bg-slate-50 text-slate-700'
          }`}
        >
          <span>TODAY</span>
          {todayCards.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              panel === 'today' ? 'bg-white text-[#1A6ECC]' : 'bg-red-500 text-white'
            }`}>{todayCards.length}</span>
          )}
        </button>

        {/* ACTIVE (no date) */}
        <button
          onClick={() => setPanel('today')}
          className="flex items-center justify-between px-4 py-2 border-b border-slate-100 text-xs text-slate-500 hover:bg-slate-50"
        >
          <span>Active (no date)</span>
          <span>{activeCards.length}</span>
        </button>

        {/* Day dividers */}
        <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
          This Month
        </div>
        {days.map(({ day, count }) => (
          <button
            key={day}
            onClick={() => setPanel({ day })}
            className={`flex items-center justify-between px-4 py-1.5 text-sm transition-colors ${
              typeof panel === 'object' && 'day' in panel && panel.day === day
                ? 'bg-blue-50 text-[#1A6ECC] font-medium'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>{day}</span>
            {count > 0 && <span className="text-xs text-slate-400">{count}</span>}
          </button>
        ))}

        {/* Month dividers */}
        {months.length > 0 && (
          <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">
            Future
          </div>
        )}
        {months.map(({ month, year, count }) => (
          <button
            key={`${month}-${year}`}
            onClick={() => setPanel({ month, year })}
            className={`flex items-center justify-between px-4 py-1.5 text-sm transition-colors ${
              typeof panel === 'object' && 'month' in panel && panel.month === month && panel.year === year
                ? 'bg-blue-50 text-[#1A6ECC] font-medium'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>{month} {year !== new Date().getFullYear() ? year : ''}</span>
            {count > 0 && <span className="text-xs text-slate-400">{count}</span>}
          </button>
        ))}

        {/* A-Z */}
        <div className="mt-2 border-t border-slate-200">
          <button
            onClick={() => setPanel('alpha')}
            className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors ${
              panel === 'alpha' ? 'bg-slate-700 text-white' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            <span>A – Z</span>
            <span className="text-xs text-slate-400">{contacts.filter(c => !c.is_active).length}</span>
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto p-6">
        {isAlpha ? (
          <div className="space-y-6">
            {Object.keys(alphaMap).sort().map(letter => (
              <div key={letter}>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{letter}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {alphaMap[letter].map(c => (
                    <ContactCard
                      key={c.id}
                      contact={c}
                      stages={stages}
                      onClick={() => onOpen(c)}
                      actions={
                        <div onClick={e => e.stopPropagation()}>
                          <button onClick={() => toActive(c)}
                            className="text-xs px-2 py-0.5 border border-slate-300 rounded hover:bg-blue-50 text-[#1A6ECC]">
                            ★ activate
                          </button>
                        </div>
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(alphaMap).length === 0 && (
              <p className="text-slate-400 text-sm">No contacts in A–Z drawer.</p>
            )}
          </div>
        ) : (
          <div>
            <h2 className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider">
              {panel === 'today' ? `Today — ${panelCards.length} card${panelCards.length !== 1 ? 's' : ''}` :
               typeof panel === 'object' && 'day' in panel ? `Day ${panel.day}` :
               typeof panel === 'object' && 'month' in panel ? `${panel.month} ${panel.year}` : ''}
            </h2>
            {panelCards.length === 0 ? (
              <p className="text-slate-400 text-sm">Nothing here.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {panelCards.map(c => (
                  <ContactCard
                    key={c.id}
                    contact={c}
                    stages={stages}
                    onClick={() => onOpen(c)}
                    actions={snoozeActions(c)}
                  />
                ))}
              </div>
            )}

            {/* Active cards (no date) shown under Today */}
            {panel === 'today' && activeCards.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Active — No Date ({activeCards.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeCards.map(c => (
                    <ContactCard
                      key={c.id}
                      contact={c}
                      stages={stages}
                      onClick={() => onOpen(c)}
                      actions={snoozeActions(c)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
