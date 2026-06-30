'use client';

import { useState, useCallback, useRef } from 'react';
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

type DropZone =
  | 'action-needed'
  | 'no-action'
  | 'alpha'
  | `month:${string}:${number}`
  | `day:${string}:${number}:${number}`;

// ── Dojo theme (exact match to dojo.enhancedops.ninja) ─────────────────────────
const T = {
  pageBg:            '#111111',
  sidebarBg:         '#1A1A1A',
  border:            '#2d2d2d',
  text:              '#FFFFFF',
  textSec:           '#9ca3af',
  textMuted:         '#6b7280',
  blue:              '#1A6BF9',
  sidebarActive:     'rgba(26,107,249,0.08)',
  sidebarActiveBorder: '#1A6BF9',
  sidebarActiveText: '#1A6BF9',
  sidebarInactive:   '#9ca3af',
  dropZoneBg:        'rgba(26,107,249,0.12)',
  dropZoneBorder:    '#1A6BF9',
  red:               '#EF4444',
  sectionLabel:      '#374151',
  dayBg:             '#111111',
};

// ── Rolling tickler: past months wrap to next year ─────────────────────────────
function buildMonthSlots(): { name: string; year: number }[] {
  const today = new Date();
  const curr = today.getMonth();
  const yr   = today.getFullYear();
  return MONTH_NAMES.map((name, idx) => ({
    name,
    year: idx < curr ? yr + 1 : yr,
  }));
}

function daysInMonthFor(name: string, year: number): number {
  return new Date(year, MONTH_NAMES.indexOf(name) + 1, 0).getDate();
}

function countForMonth(contacts: Contact[], name: string, year: number): number {
  return contactsForMonth(contacts, name, year).length;
}

function perDayCounts(contacts: Contact[], name: string, year: number): Record<number, number> {
  const mIdx = MONTH_NAMES.indexOf(name);
  const counts: Record<number, number> = {};
  for (const c of contacts) {
    if (!c.is_active || !c.next_action_date) continue;
    const d = new Date(c.next_action_date + 'T00:00:00');
    if (d.getFullYear() === year && d.getMonth() === mIdx) {
      counts[d.getDate()] = (counts[d.getDate()] ?? 0) + 1;
    }
  }
  return counts;
}

function contactsForDay(contacts: Contact[], name: string, year: number, day: number): Contact[] {
  const mIdx = MONTH_NAMES.indexOf(name);
  const target = `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return contacts.filter(c => c.is_active && c.next_action_date === target);
}

function makeDate(name: string, year: number, day: number): string {
  const mIdx = MONTH_NAMES.indexOf(name);
  return `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayStr(): string { return new Date().toISOString().slice(0, 10); }

// ── Main component ─────────────────────────────────────────────────────────────
export function OneCardView({ contacts, stages, onOpen, onRefresh }: Props) {
  const MONTH_SLOTS = buildMonthSlots();
  const currentMonthName = MONTH_NAMES[new Date().getMonth()];

  const [panel, setPanel]             = useState<Panel>('action-needed');
  const [daysDockedTo, setDaysDockedTo] = useState<string>(currentMonthName);
  const [daysOpen, setDaysOpen]       = useState(true);

  // Drag state
  const [dragCardId, setDragCardId]   = useState<string | null>(null);
  const [drag1_31, setDrag1_31]       = useState(false);
  const [dropZone, setDropZone]       = useState<DropZone | null>(null);
  const [justDropped, setJustDropped] = useState<string | null>(null); // for snap animation
  const ghostRef = useRef<HTMLElement | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────────
  const actionNeeded = todayStack(contacts);
  const noAction     = contacts.filter(c => c.is_active && !c.next_action_date);
  const alphaList    = contacts.filter(c => !c.is_active);

  function getPanelCards(): Contact[] {
    if (panel === 'action-needed') return actionNeeded;
    if (panel === 'no-action')     return noAction;
    if (panel === 'alpha')         return alphaList;
    if ('day' in panel)   return contactsForDay(contacts, panel.month, panel.year, panel.day);
    if ('month' in panel) return contactsForMonth(contacts, panel.month, panel.year);
    return [];
  }

  function panelLabel(): string {
    if (panel === 'action-needed') return `Action Needed — ${actionNeeded.length}`;
    if (panel === 'no-action')     return `No Action — ${noAction.length}`;
    if (panel === 'alpha')         return `A–Z — ${alphaList.length}`;
    if ('day' in panel)   return `${panel.month} ${panel.day}, ${panel.year}`;
    if ('month' in panel) return `${panel.month} ${panel.year}`;
    return '';
  }

  // ── Filing ────────────────────────────────────────────────────────────────────
  const fileTo = useCallback(async (cardId: string, zone: DropZone) => {
    if (zone === 'action-needed')      await fileUnderDate(cardId, todayStr());
    else if (zone === 'no-action')     await pullToActive(cardId);
    else if (zone === 'alpha')         await sendToAlpha(cardId);
    else if (zone.startsWith('month:')) {
      const [, m, yr] = zone.split(':');
      await fileUnderDate(cardId, makeDate(m, Number(yr), 1));
    } else if (zone.startsWith('day:')) {
      const [, m, yr, d] = zone.split(':');
      await fileUnderDate(cardId, makeDate(m, Number(yr), Number(d)));
    }
    setJustDropped(cardId);
    setTimeout(() => setJustDropped(null), 400);
    await onRefresh();
  }, [onRefresh]);

  // ── Card drag (physical feel) ─────────────────────────────────────────────────
  function onCardDragStart(e: React.DragEvent, contact: Contact) {
    setDragCardId(contact.id);
    e.dataTransfer.effectAllowed = 'move';

    // Build a rotated ghost that looks like a card being picked up
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.style.cssText = `
      position: absolute; top: -9999px; left: -9999px;
      width: ${rect.width}px;
      transform: rotate(4deg) scale(1.04);
      box-shadow: 0 16px 40px rgba(0,0,0,0.6);
      border-radius: 6px;
      opacity: 1;
      pointer-events: none;
    `;
    document.body.appendChild(ghost);
    ghostRef.current = ghost;
    e.dataTransfer.setDragImage(ghost, rect.width / 2, 28);
    // Clean up ghost after browser captures the image
    setTimeout(() => {
      if (ghostRef.current) {
        document.body.removeChild(ghostRef.current);
        ghostRef.current = null;
      }
    }, 0);
  }

  function onCardDragEnd() {
    setDragCardId(null);
    setDropZone(null);
  }

  // ── Zone drag handlers ────────────────────────────────────────────────────────
  function onZoneDragOver(e: React.DragEvent, zone: DropZone) {
    if (!dragCardId && !drag1_31) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropZone(zone);
  }

  function onZoneDragLeave(e: React.DragEvent) {
    // Only clear if leaving to an element outside the zone
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropZone(null);
    }
  }

  async function onZoneDrop(e: React.DragEvent, zone: DropZone) {
    e.preventDefault();
    if (drag1_31) {
      if (zone.startsWith('month:')) {
        const [, m] = zone.split(':');
        setDaysDockedTo(m);
        setDaysOpen(true);
      }
      setDrag1_31(false);
      setDropZone(null);
      return;
    }
    if (dragCardId) await fileTo(dragCardId, zone);
    setDragCardId(null);
    setDropZone(null);
  }

  // ── 1-31 divider drag ────────────────────────────────────────────────────────
  function on1_31DragStart(e: React.DragEvent) {
    setDrag1_31(true);
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  }

  // ── Snooze / quick actions ────────────────────────────────────────────────────
  function snooze(contact: Contact, days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    fileUnderDate(contact.id, d.toISOString().slice(0, 10)).then(onRefresh);
  }

  function quickActions(contact: Contact) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <QuickBtn label="+1d"   onClick={() => snooze(contact, 1)} />
        <QuickBtn label="+1wk"  onClick={() => snooze(contact, 7)} />
        <QuickBtn label="A–Z"   onClick={() => sendToAlpha(contact.id).then(onRefresh)} />
      </div>
    );
  }

  // ── Drop zone style ───────────────────────────────────────────────────────────
  function isDz(zone: DropZone) { return dropZone === zone; }

  function dzStyle(zone: DropZone): React.CSSProperties {
    const active = isDz(zone);
    if (!active) return {};
    return {
      background: T.dropZoneBg,
      outline: `2px dashed ${T.dropZoneBorder}`,
      outlineOffset: -2,
      borderRadius: 6,
    };
  }

  const panelCards = getPanelCards();
  const isDragging = dragCardId !== null;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', height: 'calc(100vh - 56px)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: T.pageBg,
    }}>

      {/* ── SIDEBAR (shoebox) ──────────────────────────────────────────────── */}
      <aside style={{
        width: 224, flexShrink: 0,
        background: T.sidebarBg,
        borderRight: `1px solid ${T.border}`,
        overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>

        {/* Action Needed */}
        <SbItem
          label="Action Needed"
          count={actionNeeded.length}
          countColor={actionNeeded.length > 0 ? T.red : undefined}
          active={panel === 'action-needed'}
          prefix="🔥"
          onClick={() => setPanel('action-needed')}
          onDragOver={e => onZoneDragOver(e, 'action-needed')}
          onDragLeave={onZoneDragLeave}
          onDrop={e => onZoneDrop(e, 'action-needed')}
          dz={dzStyle('action-needed')}
          isDragging={isDragging || drag1_31}
        />

        {/* No Action */}
        <SbItem
          label="No Action"
          count={noAction.length}
          active={panel === 'no-action'}
          prefix="○"
          onClick={() => setPanel('no-action')}
          onDragOver={e => onZoneDragOver(e, 'no-action')}
          onDragLeave={onZoneDragLeave}
          onDrop={e => onZoneDrop(e, 'no-action')}
          dz={dzStyle('no-action')}
          isDragging={isDragging || drag1_31}
        />

        {/* Section label */}
        <div style={{
          padding: '10px 14px 4px', fontSize: 9, fontWeight: 700,
          color: T.sectionLabel, letterSpacing: '0.1em', textTransform: 'uppercase',
          borderTop: `1px solid ${T.border}`, marginTop: 4,
        }}>
          Monthly Tickler
        </div>

        {/* All 12 months */}
        {MONTH_SLOTS.map(({ name, year }) => {
          const count   = countForMonth(contacts, name, year);
          const docked  = daysDockedTo === name;
          const zone: DropZone = `month:${name}:${year}`;
          const isActiveMonth =
            typeof panel === 'object' && 'month' in panel &&
            panel.month === name && panel.year === year && !('day' in panel);
          const active = isDz(zone);

          return (
            <div key={`${name}-${year}`}>
              {/* Month row */}
              <div
                style={{
                  display: 'flex', alignItems: 'stretch',
                  ...dzStyle(zone),
                  transition: 'background 0.12s',
                }}
                onDragOver={e => onZoneDragOver(e, zone)}
                onDragLeave={onZoneDragLeave}
                onDrop={e => onZoneDrop(e, zone)}
              >
                <button
                  onClick={() => {
                    setPanel({ month: name, year });
                    if (docked) setDaysOpen(o => !o);
                  }}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    paddingLeft: 11,
                    background: isActiveMonth ? T.sidebarActive : 'transparent',
                    color: isActiveMonth ? T.sidebarActiveText : T.sidebarInactive,
                    borderTop: 'none', borderRight: 'none', borderBottom: 'none',
                    borderLeft: `3px solid ${isActiveMonth ? T.sidebarActiveBorder : 'transparent'}`,
                    cursor: 'pointer', fontSize: 13,
                    fontWeight: docked ? 600 : 400,
                    textAlign: 'left',
                    transition: 'color 0.15s, background 0.15s',
                  }}
                >
                  <span>{name}</span>
                  {count > 0 && (
                    <span style={{ fontSize: 10, color: T.textMuted, marginRight: docked ? 4 : 0 }}>
                      {count}
                    </span>
                  )}
                </button>

                {/* 1-31 tab — lives inside docked month */}
                {docked && (
                  <button
                    draggable
                    onDragStart={on1_31DragStart}
                    onDragEnd={() => { setDrag1_31(false); setDropZone(null); }}
                    onClick={e => { e.stopPropagation(); setDaysOpen(o => !o); }}
                    title="Drag to move 1–31 into another month"
                    style={{
                      padding: '4px 8px', margin: '4px 4px 4px 0',
                      background: daysOpen ? T.blue : 'rgba(26,107,249,0.2)',
                      color: daysOpen ? '#fff' : '#6B9CF9',
                      border: 'none', borderRadius: 4,
                      cursor: 'grab', fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.02em', flexShrink: 0,
                      userSelect: 'none',
                    }}
                  >
                    1–31
                  </button>
                )}
              </div>

              {/* Day calendar — only on docked month when open */}
              {docked && daysOpen && (
                <DayCalendar
                  name={name} year={year} contacts={contacts} panel={panel}
                  dropZone={dropZone} isDragging={isDragging}
                  onDayClick={day => setPanel({ month: name, year, day })}
                  onDayDragOver={(e, day) => onZoneDragOver(e, `day:${name}:${year}:${day}`)}
                  onDayDragLeave={onZoneDragLeave}
                  onDayDrop={(e, day) => onZoneDrop(e, `day:${name}:${year}:${day}`)}
                />
              )}

              {/* Hint while dragging 1-31 */}
              {drag1_31 && !docked && active && (
                <div style={{ padding: '3px 14px 4px', fontSize: 10, color: T.blue }}>
                  Drop to file 1–31 here
                </div>
              )}
            </div>
          );
        })}

        {/* Drag-divider hint */}
        {drag1_31 && (
          <div style={{
            margin: '6px 10px', padding: '6px 10px', borderRadius: 6,
            border: `1px dashed ${T.blue}`,
            fontSize: 11, color: T.blue, textAlign: 'center',
          }}>
            Drop 1–31 onto a month
          </div>
        )}

        {/* A–Z */}
        <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 8 }}>
          <SbItem
            label="A – Z"
            count={alphaList.length}
            active={panel === 'alpha'}
            prefix="📋"
            onClick={() => setPanel('alpha')}
            onDragOver={e => onZoneDragOver(e, 'alpha')}
            onDragLeave={onZoneDragLeave}
            onDrop={e => onZoneDrop(e, 'alpha')}
            dz={dzStyle('alpha')}
            isDragging={isDragging || drag1_31}
          />
        </div>
      </aside>

      {/* ── MAIN AREA ─────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: T.pageBg }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: T.textMuted,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: 16,
        }}>
          {panelLabel()}
        </div>

        {panel === 'alpha' ? (
          <AlphaGrid
            contacts={alphaList} stages={stages} onOpen={onOpen} onRefresh={onRefresh}
            dragCardId={dragCardId} justDropped={justDropped}
            onCardDragStart={onCardDragStart} onCardDragEnd={onCardDragEnd}
          />
        ) : panelCards.length === 0 ? (
          <p style={{ color: T.textMuted, fontSize: 13 }}>Nothing filed here.</p>
        ) : (
          <CardGrid>
            {panelCards.map(c => (
              <CardSlot key={c.id} isDragging={dragCardId === c.id}>
                <ContactCard
                  contact={c} stages={stages}
                  onClick={() => onOpen(c)}
                  draggable
                  onDragStart={e => onCardDragStart(e, c)}
                  onDragEnd={onCardDragEnd}
                  isDragging={dragCardId === c.id}
                  justDropped={justDropped === c.id}
                  actions={quickActions(c)}
                />
              </CardSlot>
            ))}
          </CardGrid>
        )}
      </main>

      <style>{`
        @keyframes card-snap {
          0%   { transform: rotate(3deg) scale(1.04); }
          60%  { transform: rotate(-0.5deg) scale(0.99); }
          100% { transform: rotate(0deg) scale(1); }
        }
      `}</style>
    </div>
  );
}

// ── Sidebar item ───────────────────────────────────────────────────────────────
function SbItem({
  label, count, countColor, active, prefix, onClick,
  onDragOver, onDragLeave, onDrop, dz, isDragging,
}: {
  label: string; count: number; countColor?: string;
  active: boolean; prefix?: string; onClick: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  dz?: React.CSSProperties;
  isDragging: boolean;
}) {
  return (
    <button
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '9px 12px',
        paddingLeft: 11,
        background: active ? T.sidebarActive : 'transparent',
        color: active ? T.sidebarActiveText : T.sidebarInactive,
        borderTop: 'none', borderRight: 'none', borderBottom: 'none',
        borderLeft: `3px solid ${active ? T.sidebarActiveBorder : 'transparent'}`,
        cursor: 'pointer', fontSize: 13,
        fontWeight: active ? 600 : 400,
        textAlign: 'left', transition: 'color 0.15s, background 0.15s',
        ...dz,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {prefix && <span style={{ fontSize: 11, opacity: 0.8 }}>{prefix}</span>}
        {label}
      </span>
      {count > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 700,
          padding: '1px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center',
          background: countColor ? countColor : 'rgba(26,107,249,0.25)',
          color: countColor ? '#fff' : '#6B9CF9',
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Day calendar grid ──────────────────────────────────────────────────────────
function DayCalendar({
  name, year, contacts, panel, dropZone, isDragging,
  onDayClick, onDayDragOver, onDayDragLeave, onDayDrop,
}: {
  name: string; year: number; contacts: Contact[];
  panel: Panel; dropZone: DropZone | null; isDragging: boolean;
  onDayClick: (d: number) => void;
  onDayDragOver: (e: React.DragEvent, d: number) => void;
  onDayDragLeave: (e: React.DragEvent) => void;
  onDayDrop: (e: React.DragEvent, d: number) => void;
}) {
  const total  = daysInMonthFor(name, year);
  const counts = perDayCounts(contacts, name, year);

  return (
    <div style={{
      background: T.dayBg, borderTop: `1px solid ${T.border}`,
      borderBottom: `1px solid ${T.border}`, padding: '6px 8px 8px',
    }}>
      {/* Day-of-week header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 2 }}>
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} style={{
            textAlign: 'center', fontSize: 8, color: T.textMuted,
            fontWeight: 700, padding: '2px 0',
          }}>{d}</div>
        ))}
      </div>
      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {Array.from({ length: total }, (_, i) => i + 1).map(day => {
          const count = counts[day] ?? 0;
          const dzKey: DropZone = `day:${name}:${year}:${day}`;
          const activeDz  = dropZone === dzKey;
          const activeDay = typeof panel === 'object' && 'day' in panel &&
            panel.month === name && panel.year === year && panel.day === day;

          return (
            <button
              key={day}
              onClick={() => onDayClick(day)}
              onDragOver={e => onDayDragOver(e, day)}
              onDragLeave={onDayDragLeave}
              onDrop={e => onDayDrop(e, day)}
              style={{
                padding: '3px 0', borderRadius: 3,
                background: activeDz
                  ? 'rgba(26,107,249,0.3)'
                  : activeDay
                  ? T.blue
                  : isDragging ? 'rgba(26,107,249,0.06)' : 'transparent',
                border: activeDz ? `1px solid ${T.blue}` : '1px solid transparent',
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', minHeight: 26,
                color: activeDay ? '#fff' : count > 0 ? '#E2E8F0' : T.textMuted,
                fontSize: 10, fontWeight: count > 0 ? 700 : 400,
                transition: 'background 0.1s, transform 0.1s',
              }}
            >
              <span>{day}</span>
              {count > 0 && (
                <span style={{
                  width: 4, height: 4, borderRadius: '50%', marginTop: 1,
                  background: activeDay ? '#fff' : T.blue,
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Card grid wrapper ──────────────────────────────────────────────────────────
function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: 14,
    }}>
      {children}
    </div>
  );
}

// ── Card slot — shows ghost placeholder when being dragged ─────────────────────
function CardSlot({ isDragging, children }: { isDragging: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 6,
      border: isDragging ? `2px dashed ${T.border}` : '2px solid transparent',
      background: isDragging ? 'rgba(255,255,255,0.02)' : undefined,
      transition: 'all 0.15s',
      minHeight: isDragging ? 80 : undefined,
    }}>
      {isDragging ? null : children}
    </div>
  );
}

// ── Alpha grid ────────────────────────────────────────────────────────────────
function AlphaGrid({
  contacts, stages, onOpen, onRefresh, dragCardId, justDropped,
  onCardDragStart, onCardDragEnd,
}: {
  contacts: Contact[]; stages: Stage[];
  onOpen: (c: Contact) => void; onRefresh: () => Promise<void>;
  dragCardId: string | null; justDropped: string | null;
  onCardDragStart: (e: React.DragEvent, c: Contact) => void;
  onCardDragEnd: () => void;
}) {
  const groups: Record<string, Contact[]> = {};
  for (const c of contacts) {
    const letter = ((c.last_name ?? c.first_name ?? '?')[0] ?? '?').toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(c);
  }
  if (Object.keys(groups).length === 0) {
    return <p style={{ color: T.textMuted, fontSize: 13 }}>No contacts in A–Z.</p>;
  }
  return (
    <div>
      {Object.keys(groups).sort().map(letter => (
        <div key={letter} style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: T.textMuted,
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10,
          }}>{letter}</div>
          <CardGrid>
            {groups[letter].map(c => (
              <CardSlot key={c.id} isDragging={dragCardId === c.id}>
                <ContactCard
                  contact={c} stages={stages} onClick={() => onOpen(c)}
                  draggable
                  onDragStart={e => onCardDragStart(e, c)}
                  onDragEnd={onCardDragEnd}
                  isDragging={dragCardId === c.id}
                  justDropped={justDropped === c.id}
                  actions={
                    <QuickBtn
                      label="★ activate"
                      onClick={() => pullToActive(c.id).then(onRefresh)}
                      blue
                    />
                  }
                />
              </CardSlot>
            ))}
          </CardGrid>
        </div>
      ))}
    </div>
  );
}

// ── Quick action button ────────────────────────────────────────────────────────
function QuickBtn({ label, onClick, blue }: { label: string; onClick: () => void; blue?: boolean }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{
        fontSize: 10, padding: '2px 8px',
        border: `1px solid ${blue ? T.blue : '#D6CAAD'}`,
        borderRadius: 4, cursor: 'pointer', background: 'transparent',
        color: blue ? T.blue : '#5A5040',
        fontWeight: 500, transition: 'opacity 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      {label}
    </button>
  );
}
