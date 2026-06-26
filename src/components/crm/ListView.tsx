'use client';

import { useState, useMemo } from 'react';
import type { Contact, Stage } from '@/lib/crm/types';

interface Props {
  contacts: Contact[];
  stages: Stage[];
  onOpen: (c: Contact) => void;
}

type SortKey = 'name' | 'company' | 'next_action_date' | 'date_entered';

export function ListView({ contacts, stages, onOpen }: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('next_action_date');
  const [sortAsc, setSortAsc] = useState(true);

  const stageMap = useMemo(() => {
    const m: Record<string, Stage> = {};
    for (const s of stages) m[s.id] = s;
    return m;
  }, [stages]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter(c =>
      !q ||
      `${c.first_name} ${c.last_name ?? ''}`.toLowerCase().includes(q) ||
      (c.company?.toLowerCase() ?? '').includes(q) ||
      (c.email?.toLowerCase() ?? '').includes(q) ||
      (c.phone ?? '').includes(q)
    );
  }, [contacts, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = '', bv = '';
      if (sortKey === 'name')             { av = `${a.last_name ?? ''} ${a.first_name}`; bv = `${b.last_name ?? ''} ${b.first_name}`; }
      else if (sortKey === 'company')     { av = a.company ?? ''; bv = b.company ?? ''; }
      else if (sortKey === 'next_action_date') { av = a.next_action_date ?? '9999'; bv = b.next_action_date ?? '9999'; }
      else if (sortKey === 'date_entered') { av = a.date_entered ?? ''; bv = b.date_entered ?? ''; }
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [filtered, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(p => !p);
    else { setSortKey(key); setSortAsc(true); }
  }

  function SortTh({ label, k }: { label: string; k: SortKey }) {
    return (
      <th
        className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
        onClick={() => toggleSort(k)}
      >
        {label} {sortKey === k ? (sortAsc ? '↑' : '↓') : ''}
      </th>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search contacts…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <SortTh label="Name" k="name" />
              <SortTh label="Company" k="company" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Stage</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone / Email</th>
              <SortTh label="Next Action" k="next_action_date" />
              <SortTh label="Entered" k="date_entered" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map(c => {
              const stage = c.stage_id ? stageMap[c.stage_id] : null;
              return (
                <tr
                  key={c.id}
                  onClick={() => onOpen(c)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800">
                      {c.first_name} {c.last_name ?? ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{c.company ?? '—'}</td>
                  <td className="px-4 py-3">
                    {stage ? (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                        style={{ backgroundColor: stage.color }}
                      >
                        {stage.name}
                      </span>
                    ) : <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    <div>{c.phone ?? ''}</div>
                    <div className="text-xs text-slate-400">{c.email ?? ''}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#1A6ECC]">{c.next_action_date ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{c.date_entered ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-12">No contacts found.</p>
        )}
      </div>
    </div>
  );
}
