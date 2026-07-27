'use client';

/* ─── Dark palette (matches the CRM shell) ──────────────────────────────────── */
const C = {
  pageBg: '#111111',
  cardBg: '#1A1A1A',
  border: '#2d2d2d',
  blue: '#1A6BF9',
  blue2: '#3F8AE0',
  text: '#FFFFFF',
  textSec: '#9ca3af',
};

/*
 * A growing set of prospecting lists. Add an entry here each time a new list is
 * built. The hosted page is where the work happens: tap-to-call, per-person
 * called/notes, an "OCS" button per person (adds them to Action Needed), and a
 * trash button to drop anyone who isn't viable.
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
      'Tap a number to dial. On each person: OCS adds them to your Action Needed, 📝 logs a note, 🗑 removes them.',
    count: '321 contacts',
    url: 'https://enhancedops.ninja/lists/ut-snf-al.html',
  },
];

/* ─── One list card ─────────────────────────────────────────────────────────── */
function ListCard({ list }: { list: CallList }) {
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
              borderBottom: '1px solid rgba(63,138,224,0.4)',
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

      <div>
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
      </div>
    </div>
  );
}

/* ─── View ──────────────────────────────────────────────────────────────────── */
export function CallListsView() {
  return (
    <div style={{ background: C.pageBg, minHeight: 'calc(100vh - 88px)', padding: '28px 20px 60px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text }}>Call Lists</h1>
          <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.5, color: C.textSec }}>
            Prospecting lists to work. Open one to tap-to-call, log each person, and add the good ones to your
            pipeline with the <strong style={{ color: C.text }}>OCS</strong> button on their row.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {LISTS.map(list => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      </div>
    </div>
  );
}
