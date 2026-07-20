'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionItem, ActionItemStatus, Contact, TeamMember } from '@/lib/crm/types';
import { ARTEMIS_ASSIGNEE, meetingKeyOf } from '@/lib/crm/types';
import { getCrmClient } from '@/lib/crm/client';
import {
  fetchActionItems, setActionItemDone, skipActionItem, assignActionItem,
} from '@/lib/crm/data';

// ── Dojo theme tokens (same palette the other CRM views use) ──────────────────
const T = {
  panel:      '#1A1A1A',
  row:        '#141414',
  border:     'rgba(255,255,255,0.07)',
  borderHard: '#2d2d2d',
  text:       '#FFFFFF',
  textSec:    '#d1d5db',
  textMuted:  '#9ca3af',
  textFaint:  '#6b7280',
  textDim:    '#4b5563',
  blue:       '#1A6BF9',
  blueSoft:   '#6B9CF9',
  red:        '#EF4444',
  green:      '#22c55e',
  amber:      '#f59e0b',
  gold:       '#F5B301',
};

type StatusFilter = ActionItemStatus | 'all';
type OwnerFilter = 'all' | 'me' | 'artemis' | 'unassigned';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'open',    label: 'Open' },
  { id: 'done',    label: 'Done' },
  { id: 'skipped', label: 'Skipped' },
  { id: 'all',     label: 'All' },
];

// ── Date helpers — everything renders in the BROWSER's timezone, never UTC ─────

/** Local YYYY-MM-DD for "today" — the yardstick for overdue. */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * `due_date` is a bare calendar date (no time). Anchoring it at local noon keeps
 * it on the intended day in every timezone — `new Date('2026-07-14')` would be
 * parsed as UTC midnight and slide back a day for anyone west of Greenwich.
 */
function formatDueDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
  });
}

/** `meeting_date` is an instant — toLocaleString renders it in the browser's tz. */
function formatMeetingDate(iso: string | null | undefined): string {
  if (!iso) return 'No date';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'No date';
  return d.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function isOverdue(a: ActionItem): boolean {
  return a.status === 'open' && !!a.due_date && a.due_date < todayStr();
}

// ── Assign dropdown ───────────────────────────────────────────────────────────

interface AssignMenuProps {
  item: ActionItem;
  team: TeamMember[];
  disabled: boolean;
  onAssign: (assignee: string | null) => void;
}

function AssignMenu({ item, team, disabled, onAssign }: AssignMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  const isArtemis = item.assigned_to === ARTEMIS_ASSIGNEE;
  const member = team.find(m => m.id === item.assigned_to);
  const label = isArtemis ? '⚡ Artemis' : member ? member.name : 'Assign';

  function pick(assignee: string | null) {
    setOpen(false);
    if (assignee !== (item.assigned_to ?? null)) onAssign(assignee);
  }

  const assigned = isArtemis || !!member;

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        title={assigned ? 'Re-assign or clear' : 'Assign this item'}
        style={{
          padding: '3px 9px', fontSize: 11, fontWeight: 700,
          background: assigned
            ? (isArtemis ? 'rgba(245,179,1,0.12)' : 'rgba(26,107,249,0.12)')
            : 'transparent',
          color: assigned ? (isArtemis ? T.gold : T.blueSoft) : T.textFaint,
          border: `1px solid ${assigned
            ? (isArtemis ? 'rgba(245,179,1,0.35)' : 'rgba(26,107,249,0.35)')
            : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 5,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        {label} ▾
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 20,
          minWidth: 170, background: T.panel,
          border: `1px solid ${T.borderHard}`, borderRadius: 8,
          boxShadow: '0 12px 28px rgba(0,0,0,0.55)',
          overflow: 'hidden', padding: '4px 0',
        }}>
          <button onClick={() => pick(null)} style={menuItemStyle(!item.assigned_to, T.textFaint)}>
            — Unassigned —
          </button>

          {team.map(m => (
            <button key={m.id} onClick={() => pick(m.id)} style={menuItemStyle(item.assigned_to === m.id, T.textSec)}>
              {m.name}
            </button>
          ))}

          {/* Artemis is not a crm_team_members row — it's the agent. Set apart. */}
          <div style={{ height: 1, background: T.borderHard, margin: '4px 0' }} />
          <button onClick={() => pick(ARTEMIS_ASSIGNEE)} style={menuItemStyle(isArtemis, T.gold)}>
            ⚡ Artemis
          </button>
        </div>
      )}
    </div>
  );
}

function menuItemStyle(active: boolean, color: string): React.CSSProperties {
  return {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '7px 12px', fontSize: 12, fontWeight: active ? 700 : 500,
    background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
    color, border: 'none', cursor: 'pointer',
  };
}

// ── One action item row ───────────────────────────────────────────────────────

interface RowProps {
  item: ActionItem;
  team: TeamMember[];
  busy: boolean;
  onToggle: (item: ActionItem) => void;
  onSkip: (item: ActionItem) => void;
  onAssign: (item: ActionItem, assignee: string | null) => void;
}

function ActionItemRow({ item, team, busy, onToggle, onSkip, onAssign }: RowProps) {
  const done = item.status === 'done';
  const skipped = item.status === 'skipped';
  const overdue = isOverdue(item);
  const [confirming, setConfirming] = useState(false);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      background: T.row, border: `1px solid ${T.border}`,
      borderRadius: 8, padding: '9px 12px', marginBottom: 6,
      opacity: skipped ? 0.55 : 1,
    }}>
      <input
        type="checkbox"
        checked={done}
        disabled={busy}
        onChange={() => onToggle(item)}
        aria-label={done ? 'Mark as open' : 'Mark as done'}
        style={{ width: 15, height: 15, accentColor: T.blue, cursor: busy ? 'default' : 'pointer', flexShrink: 0 }}
      />

      <span style={{
        fontSize: 13, color: done || skipped ? T.textFaint : T.textSec,
        textDecoration: done || skipped ? 'line-through' : 'none',
        flex: 1, minWidth: 180, lineHeight: 1.5,
      }}>
        {item.item_text}
      </span>

      {/* Due date — only when one exists. Overdue + still open renders red. */}
      {item.due_date && (
        <span style={{
          fontSize: 11, fontWeight: 700, flexShrink: 0,
          color: overdue ? T.red : T.textFaint,
          background: overdue ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${overdue ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 5, padding: '2px 7px',
        }}>
          {overdue ? '⚠ ' : ''}Due {formatDueDate(item.due_date)}
        </span>
      )}

      {skipped && (
        <span style={{
          fontSize: 11, fontWeight: 700, color: T.amber,
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 5, padding: '2px 7px', flexShrink: 0,
        }}>
          Skipped{item.skip_reason ? ` — ${item.skip_reason}` : ''}
        </span>
      )}

      {!skipped && !confirming && (
        <button
          onClick={() => setConfirming(true)}
          disabled={busy}
          title="Skip this item"
          style={{
            padding: '3px 9px', fontSize: 11, fontWeight: 700,
            background: 'transparent', color: T.textFaint,
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1, flexShrink: 0,
          }}
        >
          Skip
        </button>
      )}

      {!skipped && confirming && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.textSec }}>Are you sure?</span>
          <button
            onClick={() => { setConfirming(false); onSkip(item); }}
            disabled={busy}
            style={{
              padding: '3px 11px', fontSize: 11, fontWeight: 700,
              background: 'rgba(245,158,11,0.15)', color: T.amber,
              border: '1px solid rgba(245,158,11,0.4)', borderRadius: 5,
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
            }}
          >
            Yes
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={busy}
            style={{
              padding: '3px 11px', fontSize: 11, fontWeight: 700,
              background: 'transparent', color: T.textFaint,
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5,
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            No
          </button>
        </div>
      )}

      <AssignMenu
        item={item}
        team={team}
        disabled={busy}
        onAssign={a => onAssign(item, a)}
      />
    </div>
  );
}

// ── The view ──────────────────────────────────────────────────────────────────

interface Props {
  team: TeamMember[];
  contacts: Contact[];
}

export function ActionItemsView({ team, contacts }: Props) {
  const [items, setItems]     = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [busyId, setBusyId]   = useState<string | null>(null);
  const [status, setStatus]   = useState<StatusFilter>('open');
  const [owner, setOwner]     = useState<OwnerFilter>('all');
  const [myId, setMyId]       = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await fetchActionItems());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load action items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // "Assigned to me" = the crm_team_members row whose email matches the session.
  useEffect(() => {
    let live = true;
    getCrmClient().auth.getUser()
      .then(({ data }) => {
        const email = data.user?.email?.toLowerCase();
        if (!live || !email) return;
        setMyId(team.find(m => m.email?.toLowerCase() === email)?.id ?? null);
      })
      .catch(() => { /* no session — the Mine chip just stays hidden */ });
    return () => { live = false; };
  }, [team]);

  const contactName = useCallback((id: string): string | null => {
    const c = contacts.find(x => x.id === id);
    return c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || (c.company ?? 'Contact') : null;
  }, [contacts]);

  // Optimistic write-through: patch local state first, persist, roll back on error.
  const persist = useCallback(async (
    item: ActionItem,
    patch: Partial<ActionItem>,
    write: () => Promise<ActionItem>,
  ) => {
    const before = item;
    setBusyId(item.id);
    setItems(p => p.map(x => x.id === item.id ? { ...x, ...patch } : x));
    try {
      const saved = await write();
      setItems(p => p.map(x => x.id === saved.id ? saved : x));
      setError('');
    } catch (e) {
      setItems(p => p.map(x => x.id === before.id ? before : x));
      setError(e instanceof Error ? e.message : 'Could not save that change');
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleToggle = useCallback((item: ActionItem) => {
    const done = item.status !== 'done';
    void persist(
      item,
      { status: done ? 'done' : 'open', completed_at: done ? new Date().toISOString() : null },
      () => setActionItemDone(item.id, done),
    );
  }, [persist]);

  const handleSkip = useCallback((item: ActionItem) => {
    // Confirmation ("Are you sure?") happens inline in the row now — no reason prompt.
    void persist(
      item,
      { status: 'skipped', skip_reason: null, completed_at: null },
      () => skipActionItem(item.id, null),
    );
  }, [persist]);

  const handleAssign = useCallback((item: ActionItem, assignee: string | null) => {
    void persist(item, { assigned_to: assignee }, () => assignActionItem(item.id, assignee));
  }, [persist]);

  // ── Filter + group ─────────────────────────────────────────────────────────
  const openCount = items.filter(i => i.status === 'open').length;

  const visible = useMemo(() => items.filter(i => {
    if (status !== 'all' && i.status !== status) return false;
    if (owner === 'artemis'    && i.assigned_to !== ARTEMIS_ASSIGNEE) return false;
    if (owner === 'unassigned' && i.assigned_to) return false;
    if (owner === 'me'         && (!myId || i.assigned_to !== myId)) return false;
    return true;
  }), [items, status, owner, myId]);

  // fetchActionItems already returns newest meeting first with insertion order
  // preserved inside each meeting, so grouping in encounter order keeps both.
  const meetings = useMemo(() => {
    const groups = new Map<string, ActionItem[]>();
    for (const i of visible) {
      const k = meetingKeyOf(i);
      const arr = groups.get(k);
      if (arr) arr.push(i); else groups.set(k, [i]);
    }
    return [...groups.values()];
  }, [visible]);

  const ownerFilters: { id: OwnerFilter; label: string }[] = [
    { id: 'all',        label: 'Anyone' },
    ...(myId ? [{ id: 'me' as const, label: 'Assigned to me' }] : []),
    { id: 'artemis',    label: '⚡ Artemis' },
    { id: 'unassigned', label: 'Unassigned' },
  ];

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header + open count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text }}>Action Items</h1>
        <span style={{
          fontSize: 12, fontWeight: 700,
          background: 'rgba(26,107,249,0.15)', color: T.blueSoft,
          border: '1px solid rgba(26,107,249,0.3)',
          borderRadius: 9999, padding: '2px 10px',
        }}>
          {openCount} open
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(f => (
            <button key={f.id} onClick={() => setStatus(f.id)} style={chipStyle(status === f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ownerFilters.map(f => (
            <button key={f.id} onClick={() => setOwner(f.id)} style={chipStyle(owner === f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{
          fontSize: 13, color: T.red, background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.25)',
          padding: '8px 12px', borderRadius: 6, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ fontSize: 13, color: T.textDim, fontStyle: 'italic' }}>Loading…</div>
      )}

      {/* Empty — nothing ingested at all */}
      {!loading && items.length === 0 && (
        <div style={{
          background: T.panel, border: `1px solid ${T.border}`,
          borderRadius: 10, padding: '28px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, color: T.textFaint }}>
            No action items yet. They&rsquo;ll appear here after your meetings are pulled in from Granola.
          </div>
        </div>
      )}

      {/* Filtered to nothing */}
      {!loading && items.length > 0 && meetings.length === 0 && (
        <div style={{ fontSize: 13, color: T.textDim, fontStyle: 'italic', padding: '8px 0' }}>
          Nothing matches these filters.
        </div>
      )}

      {/* Meetings, newest first */}
      {meetings.map(group => {
        const head = group[0];
        const attendees = (head.attendees ?? []).filter(Boolean);
        const matched = head.contact_id ? contactName(head.contact_id) : null;

        return (
          <section key={meetingKeyOf(head)} style={{ marginBottom: 26 }}>
            {/* Meeting header */}
            <div style={{
              background: T.panel, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: '12px 14px', marginBottom: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                  {head.meeting_title}
                </span>

                {matched ? (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: T.blueSoft,
                    background: 'rgba(26,107,249,0.12)',
                    border: '1px solid rgba(26,107,249,0.3)',
                    borderRadius: 5, padding: '2px 7px',
                  }}>
                    {matched}
                  </span>
                ) : head.match_confidence === 'unmatched' ? (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: T.textDim,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 5, padding: '2px 7px',
                  }}>
                    no CRM match
                  </span>
                ) : null}

                {head.match_confidence === 'ambiguous' && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: T.amber,
                    background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 5, padding: '2px 7px',
                  }}>
                    ambiguous match
                  </span>
                )}
              </div>

              <div style={{ fontSize: 12, color: T.textFaint }}>
                {formatMeetingDate(head.meeting_date)}
                {attendees.length > 0 && (
                  <>
                    <span style={{ color: T.textDim }}> · </span>
                    {attendees.join(', ')}
                  </>
                )}
              </div>
            </div>

            {group.map(item => (
              <ActionItemRow
                key={item.id}
                item={item}
                team={team}
                busy={busyId === item.id}
                onToggle={handleToggle}
                onSkip={handleSkip}
                onAssign={handleAssign}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '5px 13px', borderRadius: 9999, fontSize: 12, fontWeight: 600,
    background: active ? T.blue : 'rgba(255,255,255,0.06)',
    color: active ? '#fff' : T.textMuted,
    border: 'none', cursor: 'pointer',
  };
}
