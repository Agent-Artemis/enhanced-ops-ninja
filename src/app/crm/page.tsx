'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CrmShell } from '@/components/crm/CrmShell';
import { OneCardView } from '@/components/crm/OneCardView';
import { KanbanView } from '@/components/crm/KanbanView';
import { ListView } from '@/components/crm/ListView';
import { ContactDrawer } from '@/components/crm/ContactDrawer';
import {
  fetchContacts, fetchStages, fetchTeam, fetchSequences, fetchVoiceAgents,
} from '@/lib/crm/data';
import type { Contact, Stage, TeamMember, Sequence, VoiceAgent, CrmView } from '@/lib/crm/types';

// Create client once — safe because NEXT_PUBLIC_ vars are baked in at build time
let sb: SupabaseClient | null = null;
function getSb(): SupabaseClient {
  if (!sb) {
    sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { detectSessionInUrl: false, persistSession: true } }
    );
  }
  return sb;
}

function isAllowed(email: string) {
  return email.endsWith('@enhancedops.ninja') || email === 'jeff@augeo-hq.com';
}

// ── Login form ────────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function sendLink() {
    if (!email) return;
    setError('');
    if (!isAllowed(email)) { setError('Access restricted to @enhancedops.ninja accounts.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
        body: JSON.stringify({ email, create_user: true, options: { emailRedirectTo: 'https://crm.enhancedops.ninja' } }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.msg || `Error ${res.status}`); }
      setSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send link');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '360px', background: '#fff', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,.08)', border: '1px solid #e2e8f0', padding: '40px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🥷</div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>EON CRM</h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Sign in to continue</p>
        </div>
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📬</div>
            <p style={{ fontWeight: 600, color: '#1e293b', margin: '0 0 8px' }}>Check your email</p>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Magic link sent to <strong>{email}</strong></p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendLink()}
                placeholder="you@enhancedops.ninja"
                style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {error && <p style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: '8px', margin: 0 }}>{error}</p>}
            <button type="button" onClick={sendLink} disabled={loading}
              style={{ background: '#1A6ECC', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Sending…' : 'Send Magic Link'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '32px', height: '32px', border: '4px solid #e2e8f0', borderTopColor: '#1A6ECC', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CrmPage() {
  const [authed, setAuthed]           = useState<boolean | null>(null); // null = still checking
  const [view, setView]               = useState<CrmView>('onecard');
  const [contacts, setContacts]       = useState<Contact[]>([]);
  const [stages, setStages]           = useState<Stage[]>([]);
  const [team, setTeam]               = useState<TeamMember[]>([]);
  const [sequences, setSequences]     = useState<Sequence[]>([]);
  const [agents, setAgents]           = useState<VoiceAgent[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [drawerContact, setDrawerContact] = useState<Contact | null>(null);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    // Hard ceiling — show login after 4s no matter what
    const giveUp = setTimeout(() => setAuthed(a => a === null ? false : a), 4000);

    async function init() {
      try {
        const client = getSb();

        // 1. Check URL hash for tokens passed from the dojo
        const hash = window.location.hash.replace('#', '');
        if (hash.includes('access_token=')) {
          const p = new URLSearchParams(hash);
          const at = p.get('access_token') ?? '';
          const rt = p.get('refresh_token') ?? '';
          if (at) {
            await client.auth.setSession({ access_token: at, refresh_token: rt });
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }

        // 2. Get session (fast — reads localStorage)
        const { data } = await client.auth.getSession();
        clearTimeout(giveUp);
        const email = data.session?.user?.email ?? '';
        setAuthed(!!data.session && isAllowed(email));

        // 3. Listen for magic-link callback
        const { data: sub } = client.auth.onAuthStateChange((_e, session) => {
          const em = session?.user?.email ?? '';
          setAuthed(!!session && isAllowed(em));
        });
        subRef.current = sub.subscription;
      } catch {
        clearTimeout(giveUp);
        setAuthed(false);
      }
    }

    init();
    return () => { clearTimeout(giveUp); subRef.current?.unsubscribe(); };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [c, s, t, seq, ag] = await Promise.all([
        fetchContacts(), fetchStages(), fetchTeam(), fetchSequences(), fetchVoiceAgents(),
      ]);
      setContacts(c); setStages(s); setTeam(t); setSequences(seq); setAgents(ag);
    } catch { setAuthed(false); }
  }, []);

  useEffect(() => {
    if (authed === true) refresh().finally(() => setDataLoading(false));
  }, [authed, refresh]);

  if (authed === null) return <Spinner />;
  if (authed === false) return <LoginScreen />;
  if (dataLoading)     return <Spinner />;

  return (
    <>
      <CrmShell view={view} onViewChange={setView} onNewCard={() => { setDrawerContact(null); setDrawerOpen(true); }} />
      <main className="pt-16">
        {view === 'onecard' && <OneCardView contacts={contacts} stages={stages} onOpen={c => { setDrawerContact(c); setDrawerOpen(true); }} onRefresh={refresh} />}
        {view === 'kanban'  && <KanbanView  contacts={contacts} stages={stages} onOpen={c => { setDrawerContact(c); setDrawerOpen(true); }} onRefresh={refresh} />}
        {view === 'list'    && <ListView    contacts={contacts} stages={stages} onOpen={c => { setDrawerContact(c); setDrawerOpen(true); }} />}
      </main>
      <ContactDrawer
        open={drawerOpen} contact={drawerContact} stages={stages}
        team={team} sequences={sequences} agents={agents}
        onClose={() => { setDrawerOpen(false); setDrawerContact(null); }}
        onSaved={async () => { await refresh(); setDrawerOpen(false); setDrawerContact(null); }}
      />
    </>
  );
}
