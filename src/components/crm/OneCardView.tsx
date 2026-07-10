'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Contact, Stage } from '@/lib/crm/types';
import { appointmentOf, stackOf, stackMemberIds } from '@/lib/crm/types';
import { ContactCard } from './ContactCard';
import { fileUnderDate, pullToActive, sendToAlpha, stackCards, unstackCard } from '@/lib/crm/data';
import { MONTH_NAMES, contactsForMonth } from '@/lib/crm/filing';

interface Props {
  contacts: Contact[];
  stages: Stage[];
  onOpen: (c: Contact) => void;
  onRefresh: () => Promise<void>;
}

// ── Panel type ─────────────────────────────────────────────────────────────────
type Panel =
  | 'action-needed'
  | 'alpha'
  | { month: string; year: number }
  | { month: string; year: number; day: number };

type DropZone =
  | 'action-needed'
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

// ── Rolling tickler: 12 months starting from current month, in chronological order ─
function buildMonthSlots(): { name: string; year: number }[] {
  const today = new Date();
  const curr  = today.getMonth();
  const yr    = today.getFullYear();
  return Array.from({ length: 12 }, (_, i) => {
    const monthIdx = (curr + i) % 12;
    const year     = yr + Math.floor((curr + i) / 12);
    return { name: MONTH_NAMES[monthIdx], year };
  });
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

// Calendar order: by filed date, then appointment time (timed cards first), then name
function chronological(list: Contact[]): Contact[] {
  return [...list].sort((a, b) => {
    const da = a.next_action_date ?? '9999', db = b.next_action_date ?? '9999';
    if (da !== db) return da.localeCompare(db);
    const ta = appointmentOf(a)?.start_time, tb = appointmentOf(b)?.start_time;
    if (ta && tb) return ta.localeCompare(tb);
    if (ta) return -1;
    if (tb) return 1;
    return (a.first_name ?? '').localeCompare(b.first_name ?? '');
  });
}

function makeDate(name: string, year: number, day: number): string {
  const mIdx = MONTH_NAMES.indexOf(name);
  return `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}


// ── Main component ─────────────────────────────────────────────────────────────
export function OneCardView({ contacts, stages, onOpen, onRefresh }: Props) {
  const MONTH_SLOTS = buildMonthSlots();
  const now = new Date();
  const currentMonthName = MONTH_NAMES[now.getMonth()];

  // Open on today's day panel so the current day's worklist is front-and-center on login.
  const [panel, setPanel]             = useState<Panel>({
    month: currentMonthName, year: now.getFullYear(), day: now.getDate(),
  });
  const [daysDockedTo, setDaysDockedTo] = useState<string>(currentMonthName);
  const [daysOpen, setDaysOpen]       = useState(true);
  const [alphaOpen, setAlphaOpen]     = useState(false);
  const [focusLetter, setFocusLetter] = useState<string | null>(null);

  // Drag state
  const [dragCardId, setDragCardId]   = useState<string | null>(null);
  const [drag1_31, setDrag1_31]       = useState(false);
  const [dropZone, setDropZone]       = useState<DropZone | null>(null);
  const [justDropped, setJustDropped] = useState<string | null>(null);
  const ghostRef = useRef<HTMLElement | null>(null);

  // Year collapse — next year starts collapsed
  const currYear = new Date().getFullYear();
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(
    () => new Set([currYear + 1])
  );
  function toggleYear(yr: number) {
    setCollapsedYears(prev => {
      const next = new Set(prev);
      if (next.has(yr)) next.delete(yr); else next.add(yr);
      return next;
    });
  }

  // ── Computed ──────────────────────────────────────────────────────────────────
  // Action Needed = active contacts with NO specific date (unfiled hot leads)
  // Cards with dates live in the calendar slots — even today's date stays there
  const actionNeeded = contacts.filter(c => c.is_active && !c.next_action_date);
  // A-Z = inactive contacts only
  const alphaList    = contacts.filter(c => !c.is_active);

  // Letter counts for sidebar
  const letterCounts: Record<string, number> = {};
  for (const c of alphaList) {
    const l = (c.first_name?.[0] ?? '?').toUpperCase();
    letterCounts[l] = (letterCounts[l] ?? 0) + 1;
  }
  const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  function getPanelCards(): Contact[] {
    // Members of a stack are hidden from the list — they render as offset peeks
    // under their primary. Only primaries and standalone cards appear.
    const notMember = (c: Contact) => stackOf(c)?.role !== 'member';
    if (panel === 'action-needed') return actionNeeded.filter(notMember);
    if (panel === 'alpha')         return alphaList.filter(notMember);
    if ('day' in panel)   return chronological(contactsForDay(contacts, panel.month, panel.year, panel.day)).filter(notMember);
    if ('month' in panel) return chronological(contactsForMonth(contacts, panel.month, panel.year)).filter(notMember);
    return [];
  }

  function panelLabel(): string {
    if (panel === 'action-needed') return `Action Needed — ${actionNeeded.length}`;
    if (panel === 'alpha')         return `A–Z — ${alphaList.length}`;
    if ('day' in panel)   return `${panel.month} ${panel.day}, ${panel.year}`;
    if ('month' in panel) return `${panel.month} ${panel.year}`;
    return '';
  }

  // ── Filing ────────────────────────────────────────────────────────────────────
  const fileTo = useCallback(async (cardId: string, zone: DropZone) => {
    const apply = async (id: string) => {
      if (zone === 'action-needed')  await pullToActive(id); // active, no date
      else if (zone === 'alpha')     await sendToAlpha(id);
      else if (zone.startsWith('month:')) {
        const [, m, yr] = zone.split(':');
        await fileUnderDate(id, makeDate(m, Number(yr), 1));
      } else if (zone.startsWith('day:')) {
        const [, m, yr, d] = zone.split(':');
        await fileUnderDate(id, makeDate(m, Number(yr), Number(d)));
      }
    };
    await apply(cardId);
    // Members follow their primary on every move: file each member to the same zone.
    const card = contacts.find(c => c.id === cardId);
    if (card && stackOf(card)?.role === 'primary') {
      for (const mid of stackMemberIds(card, contacts)) await apply(mid);
    }
    setJustDropped(cardId);
    setTimeout(() => setJustDropped(null), 400);
    await onRefresh();
  }, [onRefresh, contacts]);

  // ── Card drag (physical feel) ─────────────────────────────────────────────────
  function onCardDragStart(e: React.DragEvent, contact: Contact) {
    setDragCardId(contact.id);
    e.dataTransfer.effectAllowed = 'move';
    // Store ID in dataTransfer so onZoneDragOver can detect this synchronously
    // without waiting for React state to re-render (avoids stale closure bug)
    e.dataTransfer.setData('application/crm-card', contact.id);

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

  // ── Stacking: drop a card ONTO another card ───────────────────────────────────
  const cardName = (c: Contact) => `${c.first_name} ${c.last_name ?? ''}`.trim();

  // The target card is the primary; if it's somehow a member, use its stack's primary.
  function resolvePrimaryId(target: Contact): string {
    const s = stackOf(target);
    if (s?.role === 'member') {
      const p = contacts.find(x => { const xs = stackOf(x); return xs?.id === s.id && xs.role === 'primary'; });
      return p?.id ?? target.id;
    }
    return target.id;
  }

  function onCardDragOverCard(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('application/crm-card')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  async function onCardDropOnCard(e: React.DragEvent, target: Contact) {
    const draggedId = e.dataTransfer.getData('application/crm-card');
    if (!draggedId) return;
    e.preventDefault();
    e.stopPropagation(); // don't also trigger a zone drop underneath

    const primaryId = resolvePrimaryId(target);
    if (draggedId === primaryId) return; // can't stack a card onto itself

    const dragged = contacts.find(c => c.id === draggedId);
    const targetStack = stackOf(target);
    const draggedStack = dragged ? stackOf(dragged) : null;
    if (targetStack && draggedStack && targetStack.id === draggedStack.id) return; // already same stack

    const draggedName = dragged ? cardName(dragged) : 'this card';
    if (!window.confirm(`Stack ${draggedName} under ${cardName(target)}?`)) return;

    setDragCardId(null);
    setDropZone(null);
    await stackCards(primaryId, [draggedId]);
    await onRefresh();
  }

  // ── Un-stacking: grab an offset (member) peek → offer to separate ──────────────
  function onMemberDragStart(e: React.DragEvent, member: Contact) {
    // Grabbing the offset card asks to separate. Cancel the drag either way.
    const ok = window.confirm(`Separate ${cardName(member)} from the stack?`);
    e.preventDefault();
    if (ok) unstackCard(member.id).then(onRefresh);
  }

  // ── Zone drag handlers ────────────────────────────────────────────────────────
  function onZoneDragOver(e: React.DragEvent, zone: DropZone) {
    // Check dataTransfer.types synchronously — avoids stale-closure bug where
    // dragCardId React state hasn't updated yet on the first dragover event
    const hasCard = e.dataTransfer.types.includes('application/crm-card');
    if (!hasCard && !drag1_31) return;
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
    // Read cardId from dataTransfer first (synchronous), fall back to state
    const cardId = e.dataTransfer.getData('application/crm-card') || dragCardId;
    setDragCardId(null);
    setDropZone(null);

    if (drag1_31) {
      if (zone.startsWith('month:')) {
        const [, m] = zone.split(':');
        setDaysDockedTo(m);
        setDaysOpen(true);
      }
      setDrag1_31(false);
      return;
    }
    if (cardId) await fileTo(cardId, zone);
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
      display: 'flex', height: 'calc(100vh - 88px)',
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
        />

        {/* Section label */}
        <div style={{
          padding: '10px 14px 4px', fontSize: 9, fontWeight: 700,
          color: T.sectionLabel, letterSpacing: '0.1em', textTransform: 'uppercase',
          borderTop: `1px solid ${T.border}`, marginTop: 4,
        }}>
          Monthly Tickler
        </div>

        {/* All 12 months — grouped by year with year labels */}
        {MONTH_SLOTS.map(({ name, year }, slotIdx) => {
          const prevYear = slotIdx > 0 ? MONTH_SLOTS[slotIdx - 1].year : null;
          const count   = countForMonth(contacts, name, year);
          const docked  = daysDockedTo === name;
          const zone: DropZone = `month:${name}:${year}`;
          const isActiveMonth =
            typeof panel === 'object' && 'month' in panel &&
            panel.month === name && panel.year === year && !('day' in panel);
          const active = isDz(zone);

          const yearCollapsed = collapsedYears.has(year);

          return (
            <div key={`${name}-${year}`}>
              {/* Year header — clickable to collapse/expand that year's months */}
              {(prevYear === null || prevYear !== year) && (
                <button
                  onClick={() => toggleYear(year)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 14px 4px',
                    fontSize: 10, fontWeight: 800,
                    color: year === currYear ? T.blue : T.textSec,
                    letterSpacing: '0.12em',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    borderTop: prevYear !== null ? `1px solid ${T.border}` : 'none',
                    marginTop: prevYear !== null ? 4 : 0,
                    textAlign: 'left',
                  }}
                >
                  <span>{year}</span>
                  <span style={{ fontSize: 9, opacity: 0.6 }}>{yearCollapsed ? '▶' : '▼'}</span>
                </button>
              )}

              {/* Month rows hidden when year is collapsed */}
              {!yearCollapsed && (
                <>
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
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          padding: '1px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center',
                          background: 'rgba(26,107,249,0.25)', color: '#6B9CF9',
                          marginRight: docked ? 4 : 0,
                        }}>
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
                </>
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
          {/* A-Z header — drag target + expand toggle */}
          <button
            onClick={() => { setPanel('alpha'); setAlphaOpen(o => !o); setFocusLetter(null); }}
            onDragOver={e => onZoneDragOver(e, 'alpha')}
            onDragLeave={onZoneDragLeave}
            onDrop={e => onZoneDrop(e, 'alpha')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px', paddingLeft: 11,
              background: panel === 'alpha' ? T.sidebarActive : 'transparent',
              color: panel === 'alpha' ? T.sidebarActiveText : T.sidebarInactive,
              borderTop: 'none', borderRight: 'none', borderBottom: 'none',
              borderLeft: `3px solid ${panel === 'alpha' ? T.sidebarActiveBorder : 'transparent'}`,
              cursor: 'pointer', fontSize: 13,
              fontWeight: panel === 'alpha' ? 600 : 400,
              textAlign: 'left', transition: 'color 0.15s, background 0.15s',
              ...dzStyle('alpha'),
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 11, opacity: 0.8 }}>📋</span>
              A – Z
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {alphaList.length > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  padding: '1px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center',
                  background: 'rgba(26,107,249,0.25)', color: '#6B9CF9',
                }}>
                  {alphaList.length}
                </span>
              )}
              <span style={{ fontSize: 9, opacity: 0.6 }}>{alphaOpen ? '▼' : '▶'}</span>
            </div>
          </button>

          {/* Alphabet rows */}
          {alphaOpen && ALL_LETTERS.map(letter => {
            const count = letterCounts[letter] ?? 0;
            const isActive = panel === 'alpha' && focusLetter === letter;
            return (
              <button
                key={letter}
                onClick={() => { setPanel('alpha'); setFocusLetter(letter); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 12px 4px 28px',
                  background: isActive ? T.sidebarActive : 'transparent',
                  color: count > 0 ? (isActive ? T.sidebarActiveText : T.sidebarInactive) : T.textMuted,
                  border: 'none', cursor: count > 0 ? 'pointer' : 'default',
                  fontSize: 12, fontWeight: count > 0 ? 500 : 400,
                  textAlign: 'left', opacity: count === 0 ? 0.35 : 1,
                  borderLeft: `3px solid ${isActive ? T.sidebarActiveBorder : 'transparent'}`,
                }}
                disabled={count === 0}
              >
                <span>{letter}</span>
                {count > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    padding: '1px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center',
                    background: 'rgba(26,107,249,0.25)', color: '#6B9CF9',
                    marginRight: 8,
                  }}>{count}</span>
                )}
              </button>
            );
          })}
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
            contacts={alphaList} stages={stages} onOpen={onOpen}
            dragCardId={dragCardId} justDropped={justDropped}
            onCardDragStart={onCardDragStart} onCardDragEnd={onCardDragEnd}
            onSnooze={snooze} focusLetter={focusLetter}
          />
        ) : panelCards.length === 0 ? (
          <p style={{ color: T.textMuted, fontSize: 13 }}>Nothing filed here.</p>
        ) : (() => {
          // Dated panels read like a calendar agenda: single column, time order
          const isAgenda = typeof panel === 'object' && ('day' in panel || 'month' in panel);
          const Wrapper = isAgenda ? CardStack : CardGrid;
          return (
            <Wrapper>
              {panelCards.map(c => {
                const members = stackMemberIds(c, contacts)
                  .map(id => contacts.find(x => x.id === id))
                  .filter((x): x is Contact => Boolean(x));
                const hasStack = members.length > 0;
                return (
                  <CardSlot key={c.id} isDragging={dragCardId === c.id}>
                    <div style={{ position: 'relative' }}>
                      {/* Member peeks — offset down-right behind the primary, each grabbable */}
                      {members.map((m, i) => (
                        <div
                          key={m.id}
                          draggable
                          onDragStart={e => onMemberDragStart(e, m)}
                          title={`${cardName(m)} — drag to separate`}
                          style={{
                            position: 'absolute', top: 0, left: 0, right: 0,
                            transform: `translate(${(i + 1) * 10}px, ${(i + 1) * 10}px) scale(${1 - (i + 1) * 0.02})`,
                            transformOrigin: 'top left',
                            zIndex: -(i + 1),
                            opacity: 0.85,
                            cursor: 'grab',
                            filter: 'brightness(0.97)',
                          }}
                        >
                          <ContactCard contact={m} stages={stages} />
                        </div>
                      ))}
                      {/* Primary on top — also the drop target for stacking */}
                      <div
                        style={{ position: 'relative', zIndex: 1 }}
                        onDragOver={onCardDragOverCard}
                        onDrop={e => onCardDropOnCard(e, c)}
                      >
                        <ContactCard
                          contact={c} stages={stages}
                          onDoubleClick={() => onOpen(c)}
                          draggable
                          onDragStart={e => onCardDragStart(e, c)}
                          onDragEnd={onCardDragEnd}
                          isDragging={dragCardId === c.id}
                          justDropped={justDropped === c.id}
                          actions={quickActions(c)}
                        />
                        {hasStack && (
                          <span style={{
                            position: 'absolute', top: -7, right: -7, zIndex: 2,
                            background: T.blue, color: '#fff',
                            fontSize: 11, fontWeight: 800,
                            minWidth: 22, height: 22, borderRadius: 11,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '0 6px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                            pointerEvents: 'none',
                          }}>
                            +{members.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardSlot>
                );
              })}
            </Wrapper>
          );
        })()}
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
  onDragOver, onDragLeave, onDrop, dz,
}: {
  label: string; count: number; countColor?: string;
  active: boolean; prefix?: string; onClick: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  dz?: React.CSSProperties;
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
  const total     = daysInMonthFor(name, year);
  const counts    = perDayCounts(contacts, name, year);
  // Day of week for the 1st (0=Sun … 6=Sat) — controls calendar offset
  const firstDOW  = new Date(year, MONTH_NAMES.indexOf(name), 1).getDay();

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
      {/* Day cells with correct day-of-week offset */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {/* Empty cells before day 1 */}
        {Array.from({ length: firstDOW }, (_, i) => <div key={`blank-${i}`} />)}
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

// ── Card stack — vertical agenda for dated panels ──────────────────────────────
function CardStack({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
      {children}
    </div>
  );
}

// ── Card slot — card stays visible (faded) while the ghost follows cursor ──────
function CardSlot({ children }: { isDragging: boolean; children: React.ReactNode }) {
  return <>{children}</>;
}

// ── Alpha grid ────────────────────────────────────────────────────────────────
function AlphaGrid({
  contacts, stages, onOpen, dragCardId, justDropped,
  onCardDragStart, onCardDragEnd, onSnooze, focusLetter,
}: {
  contacts: Contact[]; stages: Stage[];
  onOpen: (c: Contact) => void;
  dragCardId: string | null; justDropped: string | null;
  onCardDragStart: (e: React.DragEvent, c: Contact) => void;
  onCardDragEnd: () => void;
  onSnooze: (c: Contact, days: number) => void;
  focusLetter: string | null;
}) {
  const letterRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (focusLetter && letterRefs.current[focusLetter]) {
      letterRefs.current[focusLetter]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focusLetter]);

  const groups: Record<string, Contact[]> = {};
  for (const c of contacts) {
    const letter = (c.first_name?.[0] ?? '?').toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(c);
  }
  // Sort each group alphabetically by first name
  for (const letter of Object.keys(groups)) {
    groups[letter].sort((a, b) => (a.first_name ?? '').localeCompare(b.first_name ?? ''));
  }
  if (Object.keys(groups).length === 0) {
    return <p style={{ color: T.textMuted, fontSize: 13 }}>No contacts in A–Z.</p>;
  }
  return (
    <div>
      {Object.keys(groups).sort().map(letter => (
        <div key={letter} ref={el => { letterRefs.current[letter] = el; }} style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: T.textMuted,
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10,
          }}>{letter}</div>
          <CardGrid>
            {groups[letter].map(c => (
              <CardSlot key={c.id} isDragging={dragCardId === c.id}>
                <ContactCard
                  contact={c} stages={stages} onDoubleClick={() => onOpen(c)}
                  draggable
                  onDragStart={e => onCardDragStart(e, c)}
                  onDragEnd={onCardDragEnd}
                  isDragging={dragCardId === c.id}
                  justDropped={justDropped === c.id}
                  actions={
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <QuickBtn label="+1d"   onClick={() => onSnooze(c, 1)} />
                      <QuickBtn label="+1wk"  onClick={() => onSnooze(c, 7)} />
                      <QuickBtn label="→ Now" onClick={() => onSnooze(c, 0)} blue />
                    </div>
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
