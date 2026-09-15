'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CrmView } from '@/lib/crm/types';

interface Props {
  view: CrmView;
  onViewChange: (v: CrmView) => void;
  onNewCard: () => void;
  bookingsCount?: number;
  onToggleBookings?: () => void;
  onLogActivity?: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  showSearch?: boolean;
  /** Revenue admin? The tab is hidden otherwise. RLS is still the real gate —
   *  this only stops advertising to the whole team that money data exists. */
  canSeeRevenue?: boolean;
}

/* Every CRM section. One list, rendered twice — the desktop sidebar and the phone
   menu — so a tab added here appears in both and can never exist in only one. */
export const CRM_TABS: { id: CrmView; label: string }[] = [
  { id: 'onecard',   label: 'One Card' },
  { id: 'kanban',    label: 'Kanban' },
  { id: 'list',      label: 'List' },
  { id: 'calllists', label: 'Call Lists' },
  { id: 'actions',   label: 'Action Items' },
  { id: 'social',    label: 'Social' },
  { id: 'reports',   label: 'Reports' },
  { id: 'revenue',   label: 'Revenue' },
];

/* ══════════════════════════════════════════════════════════════════════════
   NAVIGATION — LEFT SIDEBAR ON DESKTOP, A MENU BUTTON ON A PHONE.
   Tabs moved off the top bar because it ran out of room as sections were added.

   ⛔ THE RISK IS THE PHONE. A fixed sidebar on a 390px screen either eats the
   page or gets hidden, and hidden navigation is how bi-samples lost three of six
   screens. So below 900px there is NO sidebar and NO horizontal scroll strip:
   a labelled "☰ Menu" button opens the complete list in one tap.

   Every header action survives the move on both layouts: search (card views),
   Bookings with its count, Log Activity, Print, + New Card, and ← Dojo.
   --crm-top / --crm-side are published here so views size against the real
   chrome rather than a hard-coded 88px.
   ══════════════════════════════════════════════════════════════════════════ */
const CSS = `
:root{--crm-side:220px;--crm-top:64px}
@media (max-width:899px){
  :root{--crm-side:0px;--crm-top:100px}
  :root:has(.crmx-main[data-search="1"]){--crm-top:144px}
}
.crmx-main{padding-top:var(--crm-top);padding-left:var(--crm-side);min-width:0}

.crmx-side{position:fixed;top:0;left:0;bottom:0;width:var(--crm-side);z-index:31;
  background:#141414;border-right:1px solid #2d2d2d;display:flex;flex-direction:column;
  padding:14px 12px 18px;overflow-y:auto;box-sizing:border-box}
.crmx-logo{height:52px;width:auto;object-fit:contain;align-self:flex-start;margin:0 0 14px 4px}
.crmx-dojo{display:block;padding:7px 12px;margin-bottom:14px;border-radius:6px;font-size:13px;
  font-weight:500;color:#9ca3af;text-decoration:none;border:1px solid rgba(255,255,255,.15)}
.crmx-dojo:hover{color:#fff}
.crmx-navlabel{font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;
  color:#6b7280;margin:4px 0 8px 12px}
.crmx-item{display:flex;align-items:center;width:100%;min-height:40px;text-align:left;padding:9px 12px;
  margin:0 0 2px;border:0;border-left:3px solid transparent;border-radius:0 8px 8px 0;
  background:transparent;color:#9ca3af;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit}
.crmx-item:hover{background:rgba(255,255,255,.05);color:#fff}
.crmx-item.is-active{background:rgba(26,107,249,.16);border-left-color:#1A6BF9;color:#fff;font-weight:600}
.crmx-item:focus-visible,.crmx-btn:focus-visible,.crmx-menu:focus-visible{outline:2px solid #6B9CF9;outline-offset:2px}

.crmx-top{position:fixed;top:0;right:0;left:var(--crm-side);z-index:30;background:#1A1A1A;
  border-bottom:2px solid #1A6BF9;box-sizing:border-box;height:var(--crm-top);
  display:flex;align-items:center;gap:10px;padding:0 20px}
.crmx-menu,.crmx-title{display:none}
.crmx-search{flex:1;display:flex;justify-content:center;min-width:0}
.crmx-search-in{position:relative;width:100%;max-width:420px}
.crmx-search input{width:100%;height:38px;padding:0 34px 0 14px;background:#0f1117;border:1px solid #374151;
  border-radius:8px;font-size:13px;color:#fff;outline:none;box-sizing:border-box;font-family:inherit}
.crmx-clear{position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:0;
  color:#9ca3af;font-size:18px;cursor:pointer;line-height:1;padding:4px 6px}
.crmx-acts{display:flex;gap:8px;align-items:center;flex-shrink:0}
.crmx-btn{padding:6px 14px;background:transparent;color:#d1d5db;border:1px solid rgba(255,255,255,.2);
  border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;
  justify-content:center;gap:7px;white-space:nowrap;font-family:inherit;min-height:34px;box-sizing:border-box}
.crmx-badge{background:rgba(26,107,249,.25);color:#6B9CF9;border-radius:10px;padding:1px 6px;font-weight:700;font-size:12px}
.crmx-new{background:#1A6BF9;color:#fff;border-color:#1A6BF9;flex-shrink:0}

/* phone-only menu */
.crmx-scrim{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:46}
.crmx-drawer{position:fixed;top:0;left:0;bottom:0;width:min(300px,86vw);z-index:47;background:#141414;
  border-right:1px solid #2d2d2d;display:flex;flex-direction:column;padding:12px 12px 20px;overflow-y:auto;
  box-sizing:border-box;transform:translateX(-102%);visibility:hidden;transition:transform .18s ease,visibility 0s linear .18s}
.crmx-drawer.is-open{transform:none;visibility:visible;transition:transform .18s ease}
.crmx-drawer-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.crmx-drawer .crmx-item{min-height:48px;font-size:15px}
.crmx-drawer .crmx-logo{height:40px;margin:0}
@media (prefers-reduced-motion:reduce){.crmx-drawer,.crmx-drawer.is-open{transition:none}}

@media (min-width:900px){ .crmx-drawer,.crmx-scrim{display:none} }

@media (max-width:899px){
  .crmx-side{display:none}
  .crmx-top{left:0;height:auto;min-height:var(--crm-top);padding:8px 10px;gap:6px 8px;
    display:grid;grid-template-columns:auto minmax(0,1fr) auto;
    grid-template-areas:"menu title new" "acts acts acts" "search search search";align-content:start}
  /* No search on this tab: two rows, not three. An empty third row still adds its
     row gap, which pushed the header 6px over the content below it. */
  .crmx-top[data-search="0"]{grid-template-areas:"menu title new" "acts acts acts"}
  .crmx-top[data-search="0"] .crmx-search{display:none}
  .crmx-menu{grid-area:menu;display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 12px;
    background:#0f1117;color:#fff;border:1px solid #374151;border-radius:8px;font-size:14px;font-weight:600;
    cursor:pointer;font-family:inherit}
  .crmx-menu .bars{font-size:17px;line-height:1}
  .crmx-title{grid-area:title;display:block;min-width:0;align-self:center;color:#fff;font-size:14px;font-weight:600;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .crmx-new{grid-area:new;height:40px;padding:0 12px}
  .crmx-acts{grid-area:acts;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
  .crmx-acts .crmx-btn{height:36px;min-height:36px;padding:0 6px;font-size:12.5px;min-width:0;overflow:hidden}
  .crmx-search{grid-area:search;justify-content:stretch}
  .crmx-search-in{max-width:none}
  .crmx-search input{height:38px;font-size:16px}
}
`;

export function CrmShell({ view, onViewChange, onNewCard, bookingsCount = 0, onToggleBookings, onLogActivity, search, onSearchChange, showSearch = false, canSeeRevenue = false }: Props) {
  const tabs = CRM_TABS.filter(t => t.id !== 'revenue' || canSeeRevenue);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);
  const current = tabs.find(t => t.id === view)?.label ?? 'CRM';

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuBtn.current?.focus();
  }, []);

  // While the menu is open: focus the first section, Escape closes, the page
  // behind does not scroll.
  useEffect(() => {
    if (!menuOpen) return;
    firstItem.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [menuOpen, closeMenu]);

  const go = (id: CrmView) => { onViewChange(id); setMenuOpen(false); };

  const printView = () => {
    const el = document.getElementById('crmPrintHeader');
    if (el) {
      el.textContent = `${current} — printed ${new Date().toLocaleDateString()}`;
      el.setAttribute('style', 'font-size:11pt;font-weight:700;margin-bottom:8pt;color:#000');
    }
    window.print();
  };

  const items = (inDrawer: boolean) => tabs.map((t, i) => (
    <button
      key={t.id}
      ref={inDrawer && i === 0 ? firstItem : undefined}
      className={`crmx-item${view === t.id ? ' is-active' : ''}`}
      aria-current={view === t.id ? 'page' : undefined}
      onClick={() => go(t.id)}
    >
      {t.label}
    </button>
  ));

  return (
    <>
      <style>{CSS}</style>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="crmx-side" data-print="hide" aria-label="CRM navigation">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="crmx-logo" src="/logo-dark.png" alt="EnhancedOps.ninja" />
        <a className="crmx-dojo" href="https://dojo.enhancedops.ninja">← Dojo</a>
        <div className="crmx-navlabel">CRM</div>
        <nav aria-label="CRM sections">{items(false)}</nav>
      </aside>

      {/* ── TOP BAR (both layouts) ── */}
      <header className="crmx-top" data-print="hide" data-search={showSearch ? '1' : '0'}>
        <button
          ref={menuBtn}
          className="crmx-menu"
          aria-expanded={menuOpen}
          aria-controls="crmx-drawer"
          onClick={() => setMenuOpen(o => !o)}
        >
          <span className="bars" aria-hidden="true">☰</span> Menu
        </button>
        <span className="crmx-title" aria-live="polite">{current}</span>

        {showSearch && (
          <div className="crmx-search crm-search">
            <div className="crmx-search-in">
              <input
                type="search"
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Search cards — name, company, email, phone…"
                aria-label="Search cards"
              />
              {search && (
                <button className="crmx-clear" onClick={() => onSearchChange('')} aria-label="Clear search">&times;</button>
              )}
            </div>
          </div>
        )}
        {!showSearch && <div className="crmx-search" aria-hidden="true" />}

        <div className="crmx-acts">
          {onToggleBookings && (
            <button className="crmx-btn" onClick={onToggleBookings}>
              Bookings
              {bookingsCount > 0 && <span className="crmx-badge">{bookingsCount}</span>}
            </button>
          )}
          {onLogActivity && (
            <button className="crmx-btn" onClick={onLogActivity}>Log Activity</button>
          )}
          {/* Print the current view. Lives in the shell so EVERY list is printable,
              including ones added later. Stamps a dated header first so a
              photographed page can be identified. */}
          <button className="crmx-btn" data-print="hide" onClick={printView} title="Print this list">🖨 Print</button>
        </div>

        <button className="crmx-btn crmx-new" onClick={onNewCard}>+ New Card</button>
      </header>

      {/* ── PHONE MENU ── */}
      {menuOpen && <div className="crmx-scrim" data-print="hide" onClick={closeMenu} />}
      <div
        id="crmx-drawer"
        className={`crmx-drawer${menuOpen ? ' is-open' : ''}`}
        data-print="hide"
        role="dialog"
        aria-modal="true"
        aria-label="CRM sections"
      >
        <div className="crmx-drawer-hd">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="crmx-logo" src="/logo-dark.png" alt="EnhancedOps.ninja" />
          <button className="crmx-btn" onClick={closeMenu} aria-label="Close menu">✕ Close</button>
        </div>
        <a className="crmx-dojo" href="https://dojo.enhancedops.ninja">← Dojo</a>
        <div className="crmx-navlabel">CRM</div>
        <nav aria-label="CRM sections">{items(true)}</nav>
      </div>
    </>
  );
}
