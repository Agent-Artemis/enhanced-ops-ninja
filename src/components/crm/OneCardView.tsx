'use client';

import { useState, useCallback } from 'react';
import type { Contact, Stage } from '@/lib/crm/types';
import { ContactCard } from './ContactCard';
import { fileUnderDate, pullToActive, sendToAlpha } from '@/lib/crm/data';
import { MONTH_NAMES, todayStack, contactsForMonth } from '@/lib/crm/filing';

interface Props {
  contacts: Contact[];
  stages: Stage[];
  onOpen: (c: Contact) => void;
  onRefresh: () => Promise<void>;
}

// ── Panel type ─────────────────────────────────────────────────────────────────
type Panel =
  | 'action-needed'
  | 'no-action'
  | 'alpha'
  | { month: string; year: number }
  | { month: string; year: number; day: number };

// ── Theme tokens ───────────────────────────────────────────────────────────────
const S = {
  sidebar: '#0D0D10',
  sidebarItem: 'transparent',
  sidebarHover: '#16191F',
  sidebarActive: '#1A2338',
  border: '#1E2230',
  text: '#C8D0DC',
  muted: '#546070',
  blue: '#1A6ECC',
  blueGlow: 'rgba(26,110,204,0.15)',
  red: '#EF4444',
  gold: '#D4941A',
  dropZone: 'rgba(26,110,204,0.22)',
  dropZoneBorder: '#1A6ECC',
  sectionLabel: '#3A4254',
  dayGrid: '#13151B',
};

// ── Rolling tickler months: months before today wrap to next year ───────────────
function buildMonthSlots(): { name: string; year: number }[] {
  const today = new Date();
  const curr = today.getMonth();
  const yr = today.getFullYear();
  return MONTH_NAMES.map((name, idx) => ({
    name,
    year: idx < curr ? yr + 1 : yr,
  }));
}

function daysInMonth(monthName: string, year: number): number {
  const mIdx = MONTH_NAMES.indexOf(monthName);
  return new Date(year, mIdx + 1, 0).getDate();
}

function countForMonth(contacts: Contact[], name: string, year: number): number {
  return contactsForMonth(contacts, name, year).length;
}

function contactsForDay(contacts: Contact[], monthName: string, year: number, day: number): Contact[] {
  const mIdx = MONTH_NAMES.indexOf(monthName);
  const target = `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return contacts.filter(c => c.is_active && c.next_action_date === target);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeDate(monthName: string, year: number, day: number): string {
  const mIdx = MONTH_NAMES.indexOf(monthName);
  return `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ── Drag state ─────────────────────────────────────────────────────────────────
type DropZone =
  | 'action-needed'
  | 'no-action'
  | 'alpha'
  | `month:${string}:${number}`
  | `day:${string}:${number}:${number}`;  // day:monthName:year:day

// ── Main component ─────────────────────────────────────────────────────────────
export function OneCardView({ contacts, stages, onOpen, onRefresh }: Props) {
  const MONTH_SLOTS = buildMonthSlots();
  const today = new Date();
  const currentMonthName = MONTH_NAMES[today.getMonth()];

  const [panel, setPanel] = useState<Panel>('action-needed');
  // Which month has the 1-31 tab docked inside it
  const [daysDockedTo, setDaysDockedTo] = useState<string>(currentMonthName);
  // Which months are expanded to show 1-31
  const [daysOpen, setDaysOpen] = useState(true);

  // Drag state
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [drag1_31, setDrag1_31] = useState(false);
  const [dropZone, setDropZone] = useState<DropZone | null>(null);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  // ── Computed lists ────────────────────────────────────────────────────────────
  const actionNeeded = todayStack(contacts);
  const noAction     = contacts.filter(c => c.is_active && !c.next_action_date);
  const alphaList    = contacts.filter(c => !c.is_active);

  // ── Panel card list ───────────────────────────────────────────────────────────
  function getPanelCards(): Contact[] {
    if (panel === 'action-needed') return actionNeeded;
    if (panel === 'no-action')     return noAction;
    if (panel === 'alpha')         return alphaList;
    if ('day' in panel) return contactsForDay(contacts, panel.month, panel.year, panel.day);
    if ('month' in panel) return contactsForMonth(contacts, panel.month, panel.year);
    return [];
  }

  // ── Filing actions ────────────────────────────────────────────────────────────
  const fileTo = useCallback(async (contactId: string, zone: DropZone) => {
    if (zone === 'action-needed') {
      await fileUnderDate(contactId, todayStr());
    } else if (zone === 'no-action') {
      await pullToActive(contactId);
    } else if (zone === 'alpha') {
      await sendToAlpha(contactId);
    } else if (zone.startsWith('month:')) {
      const [, mName, yr] = zone.split(':');
      await fileUnderDate(contactId, makeDate(mName, Number(yr), 1));
    } else if (zone.startsWith('day:')) {
      const [, mName, yr, d] = zone.split(':');
      await fileUnderDate(contactId, makeDate(mName, Number(yr), Number(d)));
    }
    await onRefresh();
  }, [onRefresh]);

  // ── Card drag handlers ────────────────────────────────────────────────────────
  function onCardDragStart(e: React.DragEvent, contactId: string) {
    setDragCardId(contactId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', contactId);
  }

  function onCardDragEnd() {
    setDragCardId(null);
    setDropZone(null);
    setHoveredMonth(null);
  }

  function onZoneDragOver(e: React.DragEvent, zone: DropZone, monthName?: string) {
    if (!dragCardId && !drag1_31) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropZone(zone);
    if (monthName) setHoveredMonth(monthName);
  }

  function onZoneDragLeave() {
    setDropZone(null);
  }

  async function onZoneDrop(e: React.DragEvent, zone: DropZone) {
    e.preventDefault();
    if (drag1_31) {
      if (zone.startsWith('month:')) {
        const [, mName] = zone.split(':');
        setDaysDockedTo(mName);
        setDaysOpen(true);
      }
      setDrag1_31(false);
      setDropZone(null);
      setHoveredMonth(null);
      return;
    }
    if (dragCardId) {
      await fileTo(dragCardId, zone);
    }
    setDragCardId(null);
    setDropZone(null);
    setHoveredMonth(null);
  }

  function on1_31DragStart(e: React.DragEvent) {
    setDrag1_31(true);
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  }

  // ── Snooze actions on cards ───────────────────────────────────────────────────
  function snooze(contact: Contact, days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    fileUnderDate(contact.id, d.toISOString().slice(0, 10)).then(onRefresh);
  }

  function snoozeActions(contact: Contact) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Btn label="+1d" onClick={() => snooze(contact, 1)} />
        <Btn label="+1wk" onClick={() => snooze(contact, 7)} />
        <Btn label="A–Z" onClick={() => sendToAlpha(contact.id).then(onRefresh)} />
      </div>
    );
  }

  // ── Drop zone style helper ────────────────────────────────────────────────────
  function dzStyle(zone: DropZone): React.CSSProperties {
    const active = dropZone === zone;
    return {
      background: active ? S.dropZone : undefined,
      outline: active ? `1px solid ${S.dropZoneBorder}` : undefined,
      outlineOffset: -1,
      borderRadius: 4,
    };
  }

  // ── Panel label ───────────────────────────────────────────────────────────────
  function panelLabel(): string {
    if (panel === 'action-needed') return `Action Needed — ${actionNeeded.length}`;
    if (panel === 'no-action')     return `No Action — ${noAction.length}`;
    if (panel === 'alpha')         return `A–Z — ${alphaList.length}`;
    if ('day' in panel)   return `${panel.month} ${panel.day}, ${panel.year}`;
    if ('month' in panel) return `${panel.month} ${panel.year}`;
    return '';
  }

  const panelCards = getPanelCards();

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── LEFT SIDEBAR — shoebox ─────────────────────────────────────────── */}
      <aside style={{
        width: 220, flexShrink: 0, background: S.sidebar,
        borderRight: `1px solid ${S.border}`,
        overflowY: 'auto', display: 'flex', flexDirection: 'column',
        paddingBottom: 20,
      }}>

        {/* Action Needed */}
        <SidebarItem
          label="Action Needed"
          count={actionNeeded.length}
          active={panel === 'action-needed'}
          countColor={actionNeeded.length > 0 ? S.red : undefined}
          emoji="🔥"
          onClick={() => setPanel('action-needed')}
          dropZoneProps={{
            onDragOver: e => onZoneDragOver(e, 'action-needed'),
            onDragLeave: onZoneDragLeave,
            onDrop: e => onZoneDrop(e, 'action-needed'),
          }}
          dzStyle={dzStyle('action-needed')}
        />

        {/* No Action */}
        <SidebarItem
          label="No Action"
          count={noAction.length}
          active={panel === 'no-action'}
          emoji="○"
          onClick={() => setPanel('no-action')}
          dropZoneProps={{
            onDragOver: e => onZoneDragOver(e, 'no-action'),
            onDragLeave: onZoneDragLeave,
            onDrop: e => onZoneDrop(e, 'no-action'),
          }}
          dzStyle={dzStyle('no-action')}
        />

        {/* Monthly Tickler section label */}
        <div style={{
          padding: '10px 12px 4px',
          fontSize: 9, fontWeight: 700, color: S.sectionLabel,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          borderTop: `1px solid ${S.border}`, marginTop: 4,
        }}>
          Monthly Tickler
        </div>

        {/* All 12 months */}
        {MONTH_SLOTS.map(({ name, year }) => {
          const count = countForMonth(contacts, name, year);
          const docked = daysDockedTo === name;
          const monthZone: DropZone = `month:${name}:${year}`;
          const isActiveMonth = typeof panel === 'object' && 'month' in panel && panel.month === name && panel.year === year && !('day' in panel);
          const isDzActive = dropZone === monthZone;
          const isHovered = hoveredMonth === name && dragCardId !== null;

          return (
            <div key={`${name}-${year}`}>
              {/* Month row */}
              <div
                style={{
                  display: 'flex', alignItems: 'stretch',
                  background: isDzActive ? S.dropZone : (docked ? 'rgba(26,110,204,0.07)' : undefined),
                  outline: isDzActive ? `1px solid ${S.dropZoneBorder}` : undefined,
                  outlineOffset: -1, borderRadius: isDzActive ? 4 : undefined,
                }}
                onDragOver={e => onZoneDragOver(e, monthZone, name)}
                onDragLeave={() => { onZoneDragLeave(); setHoveredMonth(null); }}
                onDrop={e => onZoneDrop(e, monthZone)}
              >
                {/* Month tab */}
                <button
                  onClick={() => {
                    setPanel({ month: name, year });
                    if (docked) setDaysOpen(o => !o);
                  }}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px 6px 14px',
                    background: isActiveMonth ? S.sidebarActive : 'transparent',
                    color: isActiveMonth ? '#E2E8F0' : S.text,
                    border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: docked ? 600 : 400,
                    textAlign: 'left',
                  }}
                >
                  <span>{name}</span>
                  {count > 0 && (
                    <span style={{ fontSize: 10, color: S.muted, marginRight: docked ? 2 : 0 }}>{count}</span>
                  )}
                </button>

                {/* 1-31 tab — only on docked month */}
                {docked && (
                  <button
                    draggable
                    onDragStart={on1_31DragStart}
                    onDragEnd={() => { setDrag1_31(false); setDropZone(null); }}
                    onClick={() => setDaysOpen(o => !o)}
                    title="Drag to move 1-31 to another month"
                    style={{
                      padding: '4px 8px',
                      background: daysOpen ? '#1A6ECC' : 'rgba(26,110,204,0.25)',
                      color: daysOpen ? '#fff' : '#7AA8D8',
                      border: 'none', cursor: 'grab', fontSize: 10, fontWeight: 700,
                      borderRadius: 4, margin: '3px 4px 3px 0',
                      letterSpacing: '0.02em', whiteSpace: 'nowrap',
                    }}
                  >
                    1–31
                  </button>
                )}
              </div>

              {/* Day grid — only on docked month when open */}
              {docked && daysOpen && (
                <DayGrid
                  monthName={name}
                  year={year}
                  contacts={contacts}
                  panel={panel}
                  dragCardId={dragCardId}
                  dropZone={dropZone}
                  onDayClick={(day) => setPanel({ month: name, year, day })}
                  onDayDragOver={(e, day) => onZoneDragOver(e, `day:${name}:${year}:${day}`)}
                  onDayDragLeave={onZoneDragLeave}
                  onDayDrop={(e, day) => onZoneDrop(e, `day:${name}:${year}:${day}`)}
                  dzStyle={(day) => dzStyle(`day:${name}:${year}:${day}`)}
                />
              )}

              {/* Other-month drop hint when card is dragging */}
              {!docked && dragCardId && (isHovered) && (
                <div style={{
                  padding: '2px 14px 4px',
                  fontSize: 10, color: S.blue, fontStyle: 'italic',
                }}>
                  Drop to file in {name}
                </div>
              )}
            </div>
          );
        })}

        {/* 1-31 drop hint when dragging the divider */}
        {drag1_31 && (
          <div style={{
            padding: '6px 14px',
            fontSize: 11, color: S.blue,
            background: 'rgba(26,110,204,0.08)',
            borderTop: `1px solid ${S.border}`,
            marginTop: 4,
          }}>
            Drop 1–31 onto any month
          </div>
        )}

        {/* A–Z */}
        <div style={{ borderTop: `1px solid ${S.border}`, marginTop: 8 }}>
          <SidebarItem
            label="A – Z"
            count={alphaList.length}
            active={panel === 'alpha'}
            emoji="📋"
            onClick={() => setPanel('alpha')}
            dropZoneProps={{
              onDragOver: e => onZoneDragOver(e, 'alpha'),
              onDragLeave: onZoneDragLeave,
              onDrop: e => onZoneDrop(e, 'alpha'),
            }}
            dzStyle={dzStyle('alpha')}
          />
        </div>
      </aside>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#111111' }}>
        <h2 style={{
          fontSize: 11, fontWeight: 700, color: '#3A4A60',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: 16, marginTop: 2,
        }}>
          {panelLabel()}
        </h2>

        {panel === 'alpha' ? (
          <AlphaGrid contacts={alphaList} stages={stages} onOpen={onOpen} onRefresh={onRefresh} />
        ) : panelCards.length === 0 ? (
          <p style={{ color: '#3A4A60', fontSize: 13 }}>Nothing filed here.</p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 12,
          }}>
            {panelCards.map(c => (
              <ContactCard
                key={c.id}
                contact={c}
                stages={stages}
                onClick={() => onOpen(c)}
                draggable
                onDragStart={e => onCardDragStart(e, c.id)}
                onDragEnd={onCardDragEnd}
                isDragging={dragCardId === c.id}
                actions={snoozeActions(c)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── SidebarItem ────────────────────────────────────────────────────────────────
function SidebarItem({
  label, count, active, countColor, emoji, onClick, dropZoneProps, dzStyle: dz,
}: {
  label: string; count: number; active: boolean;
  countColor?: string; emoji?: string;
  onClick: () => void;
  dropZoneProps: React.HTMLAttributes<HTMLButtonElement>;
  dzStyle?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      {...dropZoneProps}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px 8px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
        background: active ? S.sidebarActive : 'transparent',
        color: active ? '#E2E8F0' : S.text,
        fontSize: 13, fontWeight: active ? 600 : 400,
        ...dz,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {emoji && <span style={{ fontSize: 11 }}>{emoji}</span>}
        {label}
      </span>
      {count > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 700, minWidth: 18, textAlign: 'center',
          padding: '1px 5px', borderRadius: 10,
          background: countColor ? countColor : 'rgba(26,110,204,0.25)',
          color: countColor ? '#fff' : '#7AA8D8',
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── DayGrid ────────────────────────────────────────────────────────────────────
function DayGrid({
  monthName, year, contacts, panel, dragCardId, dropZone,
  onDayClick, onDayDragOver, onDayDragLeave, onDayDrop, dzStyle,
}: {
  monthName: string; year: number; contacts: Contact[];
  panel: Panel; dragCardId: string | null; dropZone: DropZone | null;
  onDayClick: (day: number) => void;
  onDayDragOver: (e: React.DragEvent, day: number) => void;
  onDayDragLeave: () => void;
  onDayDrop: (e: React.DragEvent, day: number) => void;
  dzStyle: (day: number) => React.CSSProperties;
}) {
  const mIdx = MONTH_NAMES.indexOf(monthName);
  const totalDays = new Date(year, mIdx + 1, 0).getDate();
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Count per day
  const counts: Record<number, number> = {};
  for (const c of contacts) {
    if (!c.is_active || !c.next_action_date) continue;
    const d = new Date(c.next_action_date + 'T00:00:00');
    if (d.getFullYear() === year && d.getMonth() === mIdx) {
      counts[d.getDate()] = (counts[d.getDate()] ?? 0) + 1;
    }
  }

  const isDragging = dragCardId !== null;

  return (
    <div style={{
      background: S.dayGrid,
      borderTop: `1px solid ${S.border}`,
      borderBottom: `1px solid ${S.border}`,
      padding: '6px 8px 8px',
    }}>
      {/* 7-col grid header */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 2, marginBottom: 2,
      }}>
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} style={{
            textAlign: 'center', fontSize: 8, color: S.muted,
            fontWeight: 700, padding: '2px 0',
          }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 2,
      }}>
        {days.map(day => {
          const count = counts[day] ?? 0;
          const isActiveDay = typeof panel === 'object' && 'day' in panel &&
            panel.month === monthName && panel.year === year && panel.day === day;
          const isDzActive = dropZone === `day:${monthName}:${year}:${day}`;

          return (
            <button
              key={day}
              onClick={() => onDayClick(day)}
              onDragOver={e => onDayDragOver(e, day)}
              onDragLeave={onDayDragLeave}
              onDrop={e => onDayDrop(e, day)}
              style={{
                padding: '3px 1px',
                background: isDzActive
                  ? 'rgba(26,110,204,0.35)'
                  : isActiveDay
                  ? '#1A6ECC'
                  : isDragging
                  ? 'rgba(26,110,204,0.08)'
                  : 'transparent',
                border: isDzActive
                  ? '1px solid #1A6ECC'
                  : '1px solid transparent',
                borderRadius: 3,
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                color: isActiveDay ? '#fff' : count > 0 ? '#E2E8F0' : S.muted,
                fontSize: 10,
                fontWeight: count > 0 ? 700 : 400,
                minHeight: 24,
                transition: 'background 0.1s',
              }}
            >
              <span>{day}</span>
              {count > 0 && (
                <span style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: isActiveDay ? '#fff' : '#1A6ECC',
                  marginTop: 1,
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── AlphaGrid ──────────────────────────────────────────────────────────────────
function AlphaGrid({
  contacts, stages, onOpen, onRefresh,
}: {
  contacts: Contact[]; stages: Stage[];
  onOpen: (c: Contact) => void; onRefresh: () => Promise<void>;
}) {
  const groups: Record<string, Contact[]> = {};
  for (const c of contacts) {
    const letter = ((c.last_name ?? c.first_name ?? '?')[0] ?? '?').toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(c);
  }

  if (Object.keys(groups).length === 0) {
    return <p style={{ color: '#3A4A60', fontSize: 13 }}>No contacts in A–Z.</p>;
  }

  return (
    <div>
      {Object.keys(groups).sort().map(letter => (
        <div key={letter} style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#3A4A60',
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8,
          }}>{letter}</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 10,
          }}>
            {groups[letter].map(c => (
              <ContactCard
                key={c.id}
                contact={c}
                stages={stages}
                onClick={() => onOpen(c)}
                actions={
                  <Btn label="★ activate" onClick={() => pullToActive(c.id).then(onRefresh)} blue />
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Small button ───────────────────────────────────────────────────────────────
function Btn({ label, onClick, blue }: { label: string; onClick: () => void; blue?: boolean }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{
        fontSize: 10, padding: '2px 7px',
        border: `1px solid ${blue ? S.blue : '#D6CAAD'}`,
        borderRadius: 4, cursor: 'pointer', background: 'transparent',
        color: blue ? S.blue : '#4A4A4A',
        fontWeight: 500,
      }}
    >
      {label}
    </button>
  );
}
