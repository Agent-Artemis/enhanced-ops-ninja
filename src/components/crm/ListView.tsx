'use client';

import { useState, useMemo } from 'react';
import type { Contact, Stage } from '@/lib/crm/types';

interface Props {
  contacts: Contact[];
  stages: Stage[];
  onOpen: (c: Contact) => void;
}

type SortKey = 'name' | 'company' | 'next_action_date' | 'date_entered';

const D = {
  bg:      '#111111',
  surface: '#1A1A1A',
  border:  '#2d2d2d',
  hover:   '#1f2937',
  text:    '#FFFFFF',
  textSec: '#9ca3af',
  textMut: '#6b7280',
  blue:    '#1A6BF9',
  input:   '#1f2937',
  inputBorder: '#374151',
};

export function ListView({ contacts, stages, onOpen }: Props) {
  const [search, setSearch]   = useState('');
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
      if (sortKey === 'name')               { av = `${a.last_name ?? ''} ${a.first_name}`; bv = `${b.last_name ?? ''} ${b.first_name}`; }
      else if (sortKey === 'company')        { av = a.company ?? ''; bv = b.company ?? ''; }
      else if (sortKey === 'next_action_date') { av = a.next_action_date ?? '9999'; bv = b.next_action_date ?? '9999'; }
      else if (sortKey === 'date_entered')   { av = a.date_entered ?? ''; bv = b.date_entered ?? ''; }
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [filtered, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(p => !p);
    else { setSortKey(key); setSortAsc(true); }
  }

  function Th({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k;
    return (
      <th
        onClick={() => toggleSort(k)}
        style={{
          padding: '10px 16px', textAlign: 'left', cursor: 'pointer',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: active ? D.blue : D.textMut,
          userSelect: 'none', whiteSpace: 'nowrap',
          borderBottom: `1px solid ${D.border}`,
          background: D.surface,
        }}
      >
        {label} {active ? (sortAsc ? '↑' : '↓') : ''}
      </th>
    );
  }

  return (
    <div style={{ padding: '20px 24px', background: D.bg, minHeight: 'calc(100vh - 56px)' }}>
      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search contacts…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', maxWidth: 400, height: 40,
            padding: '0 14px',
            background: D.input, border: `1px solid ${D.inputBorder}`,
            borderRadius: 8, fontSize: 14, color: D.text, outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Table */}
      <div style={{
        background: D.surface, borderRadius: 10,
        border: `1px solid ${D.border}`, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <Th label="Name"        k="name" />
              <Th label="Company"     k="company" />
              <th style={{
                padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase', color: D.textMut,
                borderBottom: `1px solid ${D.border}`, background: D.surface,
              }}>Stage</th>
              <th style={{
                padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase', color: D.textMut,
                borderBottom: `1px solid ${D.border}`, background: D.surface,
              }}>Phone / Email</th>
              <Th label="Next Action" k="next_action_date" />
              <Th label="Entered"     k="date_entered" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => {
              const stage = c.stage_id ? stageMap[c.stage_id] : null;
              return (
                <tr
                  key={c.id}
                  onClick={() => onOpen(c)}
                  style={{
                    cursor: 'pointer',
                    borderBottom: i < sorted.length - 1 ? `1px solid ${D.border}` : undefined,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = D.hover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '11px 16px', fontWeight: 600, fontSize: 14, color: D.text }}>
                    {c.first_name} {c.last_name ?? ''}
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: D.textSec }}>
                    {c.company ?? '—'}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    {stage ? (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: '#fff',
                        background: stage.color, padding: '2px 8px', borderRadius: 10,
                        textTransform: 'uppercase', letterSpacing: '0.03em',
                      }}>
                        {stage.name}
                      </span>
                    ) : <span style={{ color: D.textMut, fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ fontSize: 13, color: D.textSec }}>{c.phone ?? ''}</div>
                    <div style={{ fontSize: 11, color: D.textMut }}>{c.email ?? ''}</div>
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: D.blue, fontWeight: 600 }}>
                    {c.next_action_date ?? '—'}
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: D.textMut }}>
                    {c.date_entered ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <p style={{ textAlign: 'center', color: D.textMut, fontSize: 13, padding: '40px 0' }}>
            No contacts found.
          </p>
        )}
      </div>
    </div>
  );
}
