'use client';

import { useState, type ReactNode } from 'react';
import type { Contact, LeadStatus } from '@/lib/crm/types';
import { linkedinOf, pendingBookingOf } from '@/lib/crm/types';
import { setLeadStatus, advanceLinkedIn, moveLinkedInToToday, setLeadStarred, deleteContact, addNote } from '@/lib/crm/data';

const CONTENT_CALENDAR_URL =
  'https://docs.google.com/spreadsheets/d/17xf0GmuVqj1_7DEPAWnLyK6Uf-q4iSk57z2hOvwEVzM/edit';
const DM_BOOKING_URL = 'https://cal.com/enhancedopsninja/30-min';
const OPS_REVIEW_URL = 'https://cal.com/enhancedopsninja/45-min';

interface Platform {
  id: string; name: string; live: boolean;
  links: { label: string; url: string; primary?: boolean }[];
}

const PLATFORMS: Platform[] = [
  {
    id: 'linkedin', name: 'LinkedIn', live: true,
    links: [
      { label: 'Content Calendar', url: CONTENT_CALENDAR_URL, primary: true },
      { label: 'DM Booking (30-min)', url: DM_BOOKING_URL },
      { label: 'Ops Review (45-min)', url: OPS_REVIEW_URL },
      { label: 'LinkedIn Feed', url: 'https://www.linkedin.com/feed/' },
      { label: 'Sales Navigator', url: 'https://www.linkedin.com/sales/' },
    ],
  },
  { id: 'facebook',  name: 'Facebook',    live: false, links: [] },
  { id: 'instagram', name: 'Instagram',   live: false, links: [] },
  { id: 'x',         name: 'X / Twitter', live: false, links: [] },
];

const LEAD_STATUSES: { id: LeadStatus; label: string; color: string }[] = [
  { id: 'new',      label: 'New',      color: '#9ca3af' },
  { id: 'invited',  label: 'Invited',  color: '#6B9CF9' },
  { id: 'messaged', label: 'Messaged', color: '#a78bfa' },
  { id: 'replied',  label: 'Replied',  color: '#fbbf24' },
  { id: 'booked',   label: 'Booked',   color: '#22c55e' },
  { id: 'skipped',  label: 'Skipped',  color: '#4b5563' },
];

const STEP_META: Record<string, { label: string; color: string }> = {
  msg1: { label: 'New',          color: '#6B9CF9' },
  msg2: { label: 'Follow-up 1',  color: '#a78bfa' },
  msg3: { label: 'Follow-up 2',  color: '#f59e0b' },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(dateStr: string): string {
  const today = todayStr();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  if (dateStr === today)        return 'Today';
  if (dateStr === tomorrowStr)  return 'Tomorrow';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function linkify(text: string): ReactNode {
  const BOOKING_DOMAINS = /cal\.com|calendar\.app\.google|calendar\.google/;
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      if (BOOKING_DOMAINS.test(part)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{
            background: '#1A6BF9', color: '#fff',
            padding: '3px 10px', borderRadius: 6, fontWeight: 600, fontSize: 13,
            textDecoration: 'none', display: 'inline-block', margin: '2px 0',
          }}>
            {part}
          </a>
        );
      }
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{
          color: '#6B9CF9', textDecoration: 'underline',
        }}>
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ── LeadRow ───────────────────────────────────────────────────────────────────

interface LeadRowProps {
  contact: Contact;
  step: 'msg1' | 'msg2' | 'msg3';
  message: string | undefined;
  asset: string | undefined;
  busy: boolean;
  isToday: boolean;
  onMarkSent: (contact: Contact, step: 'msg1' | 'msg2' | 'msg3') => Promise<void>;
  onMoveToday: (contact: Contact) => Promise<void>;
  onStar: (contact: Contact, starred: boolean) => Promise<void>;
  onDelete: (contact: Contact) => Promise<void>;
}

function LeadRow({ contact, step, message, asset, busy, isToday, onMarkSent, onMoveToday, onStar, onDelete }: LeadRowProps) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [movedToday, setMovedToday] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const li = linkedinOf(contact)!;
  const meta = STEP_META[step];
  const name = `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim();
  const starred = !!li.starred;

  async function saveNote() {
    const body = noteText.trim();
    if (!body) return;
    await addNote(contact.id, body);
    setNoteSaved(true);
    setNoteText('');
    setTimeout(() => { setNoteSaved(false); setNoteOpen(false); }, 1500);
  }

  function copy() {
    if (!message) return;
    navigator.clipboard.writeText(message).catch(() => {/* blocked */});
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  async function markSent() {
    setConfirmed(true);
    await onMarkSent(contact, step);
  }

  async function moveToday() {
    setMovedToday(true);
    await onMoveToday(contact);
  }

  return (
    <div style={{
      background: '#141414',
      border: '1px solid rgba(255,255,255,0.07)',
      borderLeft: starred ? '3px solid #F5B301' : '1px solid rgba(255,255,255,0.07)',
      borderRadius: 8,
      marginBottom: 8,
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', flexWrap: 'wrap',
      }}>
        {/* Star toggle */}
        <button
          onClick={() => onStar(contact, !starred)}
          disabled={busy}
          title={starred ? 'Unstar' : 'Star as a strong option'}
          style={{
            background: 'transparent', border: 'none',
            cursor: busy ? 'default' : 'pointer',
            fontSize: 16, lineHeight: 1, padding: 0,
            color: starred ? '#F5B301' : '#4b5563',
            opacity: busy ? 0.5 : 1, flexShrink: 0,
            filter: starred ? 'none' : 'grayscale(1)',
          }}
        >
          {starred ? '⭐' : '☆'}
        </button>

        {/* Name */}
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {name}
        </span>

        {/* Stage badge */}
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: meta.color,
          background: `${meta.color}18`,
          border: `1px solid ${meta.color}40`,
          borderRadius: 5, padding: '2px 7px',
          flexShrink: 0,
        }}>
          {meta.label}
        </span>

        {/* Accepted badge */}
        {li.accepted && (
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: '#22c55e',
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.35)',
            borderRadius: 5, padding: '2px 7px',
            flexShrink: 0,
          }}>
            Accepted ✓
          </span>
        )}

        {/* Title @ company */}
        {(li.title || li.company) && (
          <span style={{ fontSize: 12, color: '#6b7280', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[li.title, li.company].filter(Boolean).join(' · ')}
          </span>
        )}

      </div>

      {/* Message — always visible */}
      <div style={{ padding: '0 14px 12px' }}>
        {message ? (
          <>
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 6,
              padding: '10px 12px',
              fontSize: 13, color: '#d1d5db', lineHeight: 1.65,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              marginBottom: 8,
            }}>
              {linkify(message)}
            </div>

            {/* Suggested asset */}
            {asset && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, color: '#f59e0b', marginBottom: 8,
              }}>
                <span>💡</span>
                <span><strong>Suggested asset:</strong> {asset}</span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              {/* Left: daily sequence */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={copy}
                  style={{
                    padding: '6px 14px', fontSize: 13, fontWeight: 600,
                    background: copied ? 'rgba(34,197,94,0.15)' : '#1A6BF9',
                    color: copied ? '#22c55e' : '#fff',
                    border: copied ? '1px solid rgba(34,197,94,0.4)' : 'none',
                    borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s',
                    flexShrink: 0,
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>

                <a
                  href={li.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '6px 14px', fontSize: 13, fontWeight: 600,
                    color: '#6B9CF9', textDecoration: 'none',
                    background: 'rgba(107,156,249,0.08)',
                    border: '1px solid rgba(107,156,249,0.25)',
                    borderRadius: 6, flexShrink: 0, whiteSpace: 'nowrap',
                  }}
                >
                  Profile ↗
                </a>

                <button
                  onClick={markSent}
                  disabled={busy || confirmed}
                  style={{
                    padding: '6px 14px', fontSize: 13, fontWeight: 600,
                    background: 'transparent',
                    color: confirmed ? '#22c55e' : '#9ca3af',
                    border: `1px solid ${confirmed ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 6,
                    cursor: busy || confirmed ? 'default' : 'pointer',
                    opacity: busy ? 0.5 : 1,
                    transition: 'all 0.2s', flexShrink: 0,
                  }}
                >
                  {confirmed ? '✓ Sent' : busy ? 'Saving…' : 'Mark Sent'}
                </button>

                <button
                  onClick={() => setNoteOpen(o => !o)}
                  style={{
                    padding: '6px 14px', fontSize: 13, fontWeight: 600,
                    background: noteOpen ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: '#9ca3af',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                  }}
                >
                  📝 Note
                </button>
              </div>

              {/* Right: move to today (only on upcoming leads) + delete */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {!isToday && (
                  <button
                    onClick={moveToday}
                    disabled={busy || movedToday}
                    style={{
                      padding: '5px 12px', fontSize: 12, fontWeight: 600,
                      background: 'transparent',
                      color: movedToday ? '#22c55e' : '#6b7280',
                      border: `1px solid ${movedToday ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 6, cursor: busy || movedToday ? 'default' : 'pointer',
                      opacity: busy ? 0.5 : 1, transition: 'all 0.2s', flexShrink: 0,
                    }}
                  >
                    {movedToday ? '✓ Moved' : '→ Today'}
                  </button>
                )}

                <button
                  onClick={() => onDelete(contact)}
                  disabled={busy}
                  style={{
                    padding: '5px 10px', fontSize: 12, fontWeight: 600,
                    background: 'transparent', color: '#f87171',
                    border: 'none', borderRadius: 6,
                    cursor: busy ? 'default' : 'pointer',
                    opacity: busy ? 0.5 : 1, transition: 'all 0.2s', flexShrink: 0,
                  }}
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Note editor */}
            {noteOpen && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add a note about this lead…"
                  rows={3}
                  style={{
                    width: '100%', resize: 'vertical', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6, padding: '8px 10px',
                    fontSize: 13, color: '#d1d5db', lineHeight: 1.5,
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={saveNote}
                    disabled={noteSaved || !noteText.trim()}
                    style={{
                      padding: '6px 14px', fontSize: 13, fontWeight: 600,
                      background: noteSaved ? 'rgba(34,197,94,0.15)' : '#1A6BF9',
                      color: noteSaved ? '#22c55e' : '#fff',
                      border: noteSaved ? '1px solid rgba(34,197,94,0.4)' : 'none',
                      borderRadius: 6,
                      cursor: noteSaved || !noteText.trim() ? 'default' : 'pointer',
                      opacity: !noteText.trim() && !noteSaved ? 0.5 : 1,
                      transition: 'all 0.2s', flexShrink: 0,
                    }}
                  >
                    {noteSaved ? '✓ Saved' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 12, color: '#4b5563', fontStyle: 'italic', paddingTop: 4 }}>
            Message not yet generated — check back shortly.
          </div>
        )}
      </div>
    </div>
  );
}

// ── WorkItem & DateGroup ──────────────────────────────────────────────────────

interface WorkItem {
  contact: Contact;
  step: 'msg1' | 'msg2' | 'msg3';
  message: string | undefined;
  asset: string | undefined;
  isNew: boolean;
}

interface DateGroupProps {
  date: string;
  items: WorkItem[];
  busy: string | null;
  isToday: boolean;
  onMarkSent: (contact: Contact, step: 'msg1' | 'msg2' | 'msg3') => Promise<void>;
  onMoveToday: (contact: Contact) => Promise<void>;
  onStar: (contact: Contact, starred: boolean) => Promise<void>;
  onDelete: (contact: Contact) => Promise<void>;
}

function DateGroup({ date, items, busy, isToday, onMarkSent, onMoveToday, onStar, onDelete }: DateGroupProps) {
  const newItems      = items.filter(i => i.isNew);
  const followUpItems = items.filter(i => !i.isNew).sort((a, b) => {
    // msg2 before msg3
    if (a.step !== b.step) return a.step < b.step ? -1 : 1;
    return 0;
  });

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Date header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: isToday ? '#fff' : '#9ca3af' }}>
          {formatDateLabel(date)}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600,
          background: isToday ? 'rgba(26,107,249,0.15)' : 'rgba(255,255,255,0.05)',
          color: isToday ? '#6B9CF9' : '#6b7280',
          border: `1px solid ${isToday ? 'rgba(26,107,249,0.3)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 9999, padding: '2px 9px',
        }}>
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* New connection requests */}
      {newItems.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            New — Connection Requests ({newItems.length})
          </div>
          {newItems.map(item => (
            <LeadRow
              key={item.contact.id}
              contact={item.contact}
              step={item.step}
              message={item.message}
              asset={item.asset}
              busy={busy === item.contact.id}
              isToday={isToday}
              onMarkSent={onMarkSent}
              onMoveToday={onMoveToday}
              onStar={onStar}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {/* Follow-ups */}
      {followUpItems.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Follow-Ups ({followUpItems.length})
          </div>
          {followUpItems.map(item => (
            <LeadRow
              key={item.contact.id}
              contact={item.contact}
              step={item.step}
              message={item.message}
              asset={item.asset}
              busy={busy === item.contact.id}
              isToday={isToday}
              onMarkSent={onMarkSent}
              onMoveToday={onMoveToday}
              onStar={onStar}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── SocialView ────────────────────────────────────────────────────────────────

interface Props {
  contacts: Contact[];
  onRefresh: () => void;
}

export function SocialView({ contacts, onRefresh }: Props) {
  const [platform, setPlatform] = useState('linkedin');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [showFunnel, setShowFunnel] = useState(false);
  const active = PLATFORMS.find(p => p.id === platform)!;

  const leads = contacts
    .map(c => ({ contact: c, li: linkedinOf(c) }))
    .filter((x): x is { contact: Contact; li: NonNullable<ReturnType<typeof linkedinOf>> } =>
      x.li !== null);

  // Funnel stats
  const counts: Record<string, number> = {};
  for (const { li } of leads) counts[li.status] = (counts[li.status] ?? 0) + 1;
  const booked = leads.filter(({ contact, li }) =>
    li.status === 'booked' || pendingBookingOf(contact)?.source === 'linkedin-dm').length;

  // ── Build dated work queue ──────────────────────────────────────────────────

  const today = todayStr();

  // Group all actionable items by date (today + overdue → "today", future → upcoming)
  const todayItems: WorkItem[] = [];
  const upcomingMap = new Map<string, WorkItem[]>();

  for (const { contact, li } of leads) {
    const step = li.sequence_step;
    if (!step || step === 'done' || !li.sequence_due) continue;

    const asset = step === 'msg2' ? li.msg2_asset : step === 'msg3' ? li.msg3_asset : undefined;
    const message = (li.accepted === true && li.accepted_msg)
      ? li.accepted_msg
      : li[step] as string | undefined;
    const item: WorkItem = {
      contact, step: step as 'msg1' | 'msg2' | 'msg3',
      message, asset,
      isNew: step === 'msg1',
    };

    if (li.sequence_due <= today) {
      todayItems.push(item);
    } else {
      const arr = upcomingMap.get(li.sequence_due) ?? [];
      arr.push(item);
      upcomingMap.set(li.sequence_due, arr);
    }
  }

  // Sort today: new (msg1) first, then msg2, then msg3; within each group alphabetical
  todayItems.sort((a, b) => {
    if (a.step !== b.step) return a.step < b.step ? -1 : 1;
    const na = `${a.contact.first_name} ${a.contact.last_name ?? ''}`;
    const nb = `${b.contact.first_name} ${b.contact.last_name ?? ''}`;
    return na.localeCompare(nb);
  });

  const upcomingDates = Array.from(upcomingMap.keys()).sort();

  const hasTodayWork     = todayItems.length > 0;
  const hasAnyLeads      = leads.length > 0;
  const pendingWithNoDue = leads.filter(({ li }) => li.sequence_step && li.sequence_step !== 'done' && !li.sequence_due).length;
  const allDoneForToday  = !hasTodayWork && leads.some(({ li }) => {
    return li.sequence_due && li.sequence_due <= today &&
      (!li.sequence_step || li.sequence_step === 'done');
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleMarkSent(contact: Contact, step: 'msg1' | 'msg2' | 'msg3') {
    setBusy(contact.id);
    try { await advanceLinkedIn(contact, step); onRefresh(); } finally { setBusy(null); }
  }

  async function handleMoveToday(contact: Contact) {
    setBusy(contact.id);
    try { await moveLinkedInToToday(contact); onRefresh(); } finally { setBusy(null); }
  }

  async function changeStatus(contact: Contact, status: string) {
    setBusy(contact.id);
    try { await setLeadStatus(contact, status); onRefresh(); } finally { setBusy(null); }
  }

  async function handleStar(contact: Contact, starred: boolean) {
    setBusy(contact.id);
    try { await setLeadStarred(contact, starred); onRefresh(); } finally { setBusy(null); }
  }

  async function handleDelete(contact: Contact) {
    const name = `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || 'this lead';
    if (!confirm(`Delete ${name} from the CRM? This can't be undone.`)) return;
    setBusy(contact.id);
    try { await deleteContact(contact.id); onRefresh(); } finally { setBusy(null); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px 28px', maxWidth: 860, margin: '0 auto' }}>

      {/* Platform tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {PLATFORMS.map(p => (
          <button key={p.id} onClick={() => p.live && setPlatform(p.id)} style={{
            padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500,
            border: 'none', cursor: p.live ? 'pointer' : 'default',
            background: platform === p.id ? '#1A6BF9' : 'rgba(255,255,255,0.06)',
            color: platform === p.id ? '#fff' : p.live ? '#d1d5db' : '#4b5563',
          }}>
            {p.name}
            {!p.live && <span style={{ marginLeft: 6, fontSize: 10, color: '#4b5563' }}>soon</span>}
          </button>
        ))}
      </div>

      {/* Quick links */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
        {active.links.map(l => (
          <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 15px', borderRadius: 7, textDecoration: 'none',
            background: l.primary ? '#1A6BF9' : '#1A1A1A',
            border: l.primary ? 'none' : '1px solid rgba(255,255,255,0.08)',
            color: '#fff', fontSize: 13, fontWeight: 600,
          }}>
            {l.label} <span style={{ fontSize: 10, opacity: 0.5 }}>↗</span>
          </a>
        ))}
      </div>

      {/* ── Today's queue ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>

        {/* All done banner */}
        {!hasTodayWork && allDoneForToday && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.3)',
            borderRadius: 10, padding: '18px 22px', marginBottom: 28,
          }}>
            <span style={{ fontSize: 28 }}>✅</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>All done for today!</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>
                {`You've worked through today's list. Scroll down to preview tomorrow if you want.`}
              </div>
            </div>
          </div>
        )}

        {/* Pending — no dates set yet */}
        {!hasTodayWork && !allDoneForToday && pendingWithNoDue > 0 && (
          <div style={{
            background: 'rgba(26,107,249,0.06)', border: '1px solid rgba(26,107,249,0.2)',
            borderRadius: 8, padding: '14px 18px', marginBottom: 20,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#6B9CF9', marginBottom: 4 }}>
              {leads.length} leads loaded — queue being scheduled
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Artemis is staggering send dates (~20 new/day). Your dated list will appear here the moment dates are set.
            </div>
          </div>
        )}

        {/* Empty — no leads at all */}
        {!hasAnyLeads && (
          <div style={{ fontSize: 13, color: '#4b5563', fontStyle: 'italic', padding: '8px 0' }}>
            No leads yet.
          </div>
        )}

        {/* Today's actual work */}
        {hasTodayWork && (
          <DateGroup
            date={today}
            items={todayItems}
            busy={busy}
            isToday
            onMarkSent={handleMarkSent}
            onMoveToday={handleMoveToday}
            onStar={handleStar}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* ── Upcoming ──────────────────────────────────────────────────────── */}
      {upcomingDates.length > 0 && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: 24, marginBottom: 24,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#4b5563', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>
            Upcoming
          </div>
          {upcomingDates.map(date => (
            <DateGroup
              key={date}
              date={date}
              items={upcomingMap.get(date)!.sort((a, b) => {
                if (a.step !== b.step) return a.step < b.step ? -1 : 1;
                return `${a.contact.first_name}${a.contact.last_name ?? ''}`.localeCompare(`${b.contact.first_name}${b.contact.last_name ?? ''}`);
              })}
              busy={busy}
              isToday={false}
              onMarkSent={handleMarkSent}
              onMoveToday={handleMoveToday}
              onStar={handleStar}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ── Funnel overview (collapsible) ─────────────────────────────────── */}
      <div style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
        <button
          onClick={() => setShowFunnel(f => !f)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13, fontWeight: 600 }}
        >
          <span>Funnel — {leads.length} total leads</span>
          <span style={{ fontSize: 11, color: '#4b5563' }}>{showFunnel ? '▲ hide' : '▼ show'}</span>
        </button>

        {showFunnel && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 18px' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {LEAD_STATUSES.filter(s => s.id !== 'skipped').map(s => (
                <button key={s.id}
                  onClick={() => setStatusFilter(statusFilter === s.id ? 'all' : s.id)}
                  style={{
                    flex: '1 1 72px', background: 'rgba(255,255,255,0.03)',
                    border: statusFilter === s.id ? `1px solid ${s.color}` : '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 8, padding: '9px 6px', cursor: 'pointer', textAlign: 'center',
                  }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>
                    {s.id === 'booked' ? booked : (counts[s.id] ?? 0)}
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </button>
              ))}
            </div>

            {statusFilter !== 'all' && (() => {
              const shown = leads.filter(({ li }) => li.status === statusFilter);
              return shown.length === 0 ? (
                <div style={{ fontSize: 13, color: '#4b5563' }}>No leads at this stage.</div>
              ) : (
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {shown.map(({ contact, li }) => {
                    const sm = LEAD_STATUSES.find(s => s.id === li.status);
                    const n = `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim();
                    return (
                      <div key={contact.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 2px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', minWidth: 140 }}>{n}</span>
                        <span style={{ fontSize: 12, color: '#6b7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[li.title, li.company].filter(Boolean).join(' · ')}
                        </span>
                        <a href={li.profile_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#6B9CF9', textDecoration: 'none', flexShrink: 0 }}>Profile ↗</a>
                        <select value={li.status} disabled={busy === contact.id} onChange={e => changeStatus(contact, e.target.value)}
                          style={{ background: 'rgba(255,255,255,0.06)', color: sm?.color ?? '#d1d5db', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '3px 6px', flexShrink: 0 }}>
                          {LEAD_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
