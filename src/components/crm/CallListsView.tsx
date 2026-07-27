'use client';

import { useState } from 'react';
import { upsertContact, addNote } from '@/lib/crm/data';

/* ─── Dark palette (matches the CRM shell) ──────────────────────────────────── */
const C = {
  pageBg: '#111111',
  cardBg: '#1A1A1A',
  border: '#2d2d2d',
  blue: '#1A6BF9',
  blue2: '#3F8AE0',
  gold: '#F5B301',
  green: '#4ade80',
  red: '#ef4444',
  text: '#FFFFFF',
  textSec: '#9ca3af',
};

/*
 * A growing set of prospecting lists. Add an entry here each time a new list is
 * built. `url` opens the hosted tap-to-call sheet (per-person called/notes live
 * inside that page). Titles link to the same place.
 */
interface CallList {
  id: string;
  title: string;
  blurb: string;
  count: string;
  url: string;
}

const LISTS: CallList[] = [
  {
    id: 'ut-snf-al',
    title: 'Utah — SNF & AL Administrators',
    blurb:
      '224 assisted-living administrators (name + phone) plus 97 skilled-nursing facilities. ' +
      'Tap a number to dial; tap a name to log the call and jot a note on that person.',
    count: '321 contacts',
    url: 'https://enhancedops.ninja/lists/ut-snf-al.html',
  },
];

/* ─── One list card ─────────────────────────────────────────────────────────── */
function ListCard({ list, onRefresh }: { list: CallList; onRefresh?: () => void }) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function createOcsCard() {
    setStatus('saving');
    setErrMsg(null);
    try {
      // is_active + no next_action_date → lands in the "Action Needed" section
      // (OneCardView: actionNeeded = contacts.filter(c => c.is_active && !c.next_action_date)).
      const card = await upsertContact({
        first_name: `📞 Call list: ${list.title}`,
        company: 'Call List',
        is_active: true,
        bucket: 'active',
        tags: ['call-list'],
        custom_fields: { call_list_url: list.url, call_list_id: list.id },
      });
      await addNote(card.id, `Call list — work these prospects.\nList: ${list.url}`);
      setStatus('done');
      onRefresh?.();
    } catch (e) {
      setStatus('error');
      setErrMsg(e instanceof Error ? e.message : 'Could not create the card');
    }
  }

  return (
    <div
      style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <a
            href={list.url}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: C.blue2,
              textDecoration: 'none',
              borderBottom: `1px solid rgba(63,138,224,0.4)`,
              paddingBottom: 1,
            }}
          >
            {list.title}
          </a>
          <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5, color: C.textSec }}>{list.blurb}</p>
        </div>
        <span
          style={{
            flexShrink: 0,
            fontSize: 12,
            fontWeight: 700,
            color: C.blue,
            background: 'rgba(26,107,249,0.12)',
            padding: '4px 10px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}
        >
          {list.count}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <a
          href={list.url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 40,
            padding: '0 18px',
            borderRadius: 8,
            background: C.blue,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Open list ↗
        </a>

        <button
          onClick={createOcsCard}
          disabled={status === 'saving' || status === 'done'}
          style={{
            height: 40,
            padding: '0 18px',
            borderRadius: 8,
            border: 'none',
            background: status === 'done' ? 'rgba(74,222,128,0.15)' : C.gold,
            color: status === 'done' ? C.green : '#1a1a1a',
            fontSize: 14,
            fontWeight: 700,
            cursor: status === 'saving' || status === 'done' ? 'default' : 'pointer',
          }}
        >
          {status === 'saving'
            ? 'Creating…'
            : status === 'done'
            ? '✓ Card created — in Action Needed'
            : 'Create OCS card'}
        </button>

        {status === 'done' && (
          <span style={{ fontSize: 13, color: C.green, fontWeight: 500 }}>
            Dropped into One Card → Action Needed.
          </span>
        )}
        {status === 'error' && (
          <span style={{ fontSize: 13, color: C.red, fontWeight: 500 }}>Couldn’t create card: {errMsg}</span>
        )}
      </div>
    </div>
  );
}

/* ─── View ──────────────────────────────────────────────────────────────────── */
export function CallListsView({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <div style={{ background: C.pageBg, minHeight: 'calc(100vh - 88px)', padding: '28px 20px 60px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text }}>Call Lists</h1>
          <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.5, color: C.textSec }}>
            Prospecting lists to work. Open one to tap-to-call and log each person as you go, then hit{' '}
            <strong style={{ color: C.text }}>Create OCS card</strong> to drop it into your{' '}
            <strong style={{ color: C.text }}>Action Needed</strong> section.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {LISTS.map(list => (
            <ListCard key={list.id} list={list} onRefresh={onRefresh} />
          ))}
        </div>
      </div>
    </div>
  );
}
