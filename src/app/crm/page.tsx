'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { CrmShell } from '@/components/crm/CrmShell';
import { OneCardView } from '@/components/crm/OneCardView';
import { KanbanView } from '@/components/crm/KanbanView';
import { ListView } from '@/components/crm/ListView';
import { ContactDrawer } from '@/components/crm/ContactDrawer';
import {
  fetchContacts, fetchStages, fetchTeam, fetchSequences, fetchVoiceAgents,
} from '@/lib/crm/data';
import type { Contact, Stage, TeamMember, Sequence, VoiceAgent, CrmView } from '@/lib/crm/types';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
// Supabase stores sessions under this key
const SB_STORAGE_KEY = `sb-${SB_URL.match(/\/\/([^.]+)/)?.[1] ?? 'supabase'}-auth-token`;

function isAllowed(email: string) {
  return email.endsWith('@enhancedops.ninja') || email === 'jeff@augeo-hq.com';
}

/** Read session directly from localStorage — zero network, zero async */
function readLocalSession(): { access_token: string; refresh_token: string; user: { email: string } } | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SB_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Supabase v2 wraps in { currentSession, expiresAt } or stores flat
    const session = parsed?.currentSession ?? parsed;
    if (!session?.access_token) return null;
    // Check expiry
    const expiresAt = parsed?.expiresAt ?? session?.expires_at ?? 0;
    if (expiresAt && expiresAt < Date.now() / 1000) return null;
    return session;
  } catch { return null; }
}

/** Write tokens into localStorage in Supabase's expected format */
function writeLocalSession(access_token: string, refresh_token: string) {
  if (typeof localStorage === 'undefined') return;
  // Decode JWT to get user + expiry without a network call
  try {
    const payload = JSON.parse(atob(access_token.split('.')[1]));
    const session = { access_token, refresh_token, token_type: 'bearer', expires_in: 3600, expires_at: payload.exp, user: payload };
    localStorage.setItem(SB_STORAGE_KEY, JSON.stringify({ currentSession: session, expiresAt: payload.exp }));
  } catch { /* ignore */ }
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
      const res = await fetch(`${SB_URL}/auth/v1/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY },
        body: JSON.stringify({ email, create_user: true, options: { emailRedirectTo: 'https://crm.enhancedops.ninja' } }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.msg || `Error ${res.status}`); }
      setSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send link');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:'360px', background:'#fff', borderRadius:'16px', boxShadow:'0 2px 12px rgba(0,0,0,.08)', border:'1px solid #e2e8f0', padding:'40px 32px' }}>
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <div style={{ fontSize:'40px', marginBottom:'8px' }}>🥷</div>
          <h1 style={{ fontSize:'20px', fontWeight:700, color:'#1e293b', margin:'0 0 4px' }}>EON CRM</h1>
          <p style={{ fontSize:'14px', color:'#64748b', margin:0 }}>Sign in to continue</p>
        </div>
        {sent ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'36px', marginBottom:'12px' }}>📬</div>
            <p style={{ fontWeight:600, color:'#1e293b', margin:'0 0 8px' }}>Check your email</p>
            <p style={{ fontSize:'14px', color:'#64748b', margin:0 }}>Magic link sent to <strong>{email}</strong></p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div>
              <label style={{ display:'block', fontSize:'12px', fontWeight:600, color:'#475569', marginBottom:'6px' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendLink()}
                placeholder="you@enhancedops.ninja"
                style={{ width:'100%', border:'1px solid #cbd5e1', borderRadius:'8px', padding:'10px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' }} />
            </div>
            {error && <p style={{ fontSize:'13px', color:'#dc2626', background:'#fef2f2', padding:'8px 12px', borderRadius:'8px', margin:0 }}>{error}</p>}
            <button type="button" onClick={sendLink} disabled={loading}
              style={{ background:'#1A6ECC', color:'#fff', border:'none', borderRadius:'8px', padding:'11px', fontSize:'14px', fontWeight:600, cursor:loading?'not-allowed':'pointer', opacity:loading?0.6:1 }}>
              {loading ? 'Sending…' : 'Send Magic Link'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CrmPage() {
  // Default FALSE — login form shows immediately (SSR-safe, no spinner)
  // Upgraded to TRUE only when JS confirms a valid session
  const [authed, setAuthed]           = useState(false);
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
    // 1. Check URL hash for tokens passed from dojo — synchronous, no network
    const hash = window.location.hash.replace('#', '');
    if (hash.includes('access_token=')) {
      const p = new URLSearchParams(hash);
      const at = p.get('access_token') ?? '';
      const rt = p.get('refresh_token') ?? '';
      if (at) {
        writeLocalSession(at, rt);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }

    // 2. Read session from localStorage — synchronous, no network
    const session = readLocalSession();
    if (session && isAllowed(session.user?.email ?? '')) {
      setAuthed(true);
      return; // Already have session — skip Supabase SDK entirely
    }

    // 3. No session in localStorage — listen for magic link callback via SDK
    // (only reached when user needs to log in fresh)
    import('@supabase/supabase-js').then(({ createClient }) => {
      const client = createClient(SB_URL, SB_KEY, { auth: { detectSessionInUrl: true, persistSession: true } });
      const { data: sub } = client.auth.onAuthStateChange((_e, s) => {
        const em = s?.user?.email ?? '';
        if (s && isAllowed(em)) setAuthed(true);
      });
      subRef.current = sub.subscription;
    }).catch(() => { /* SDK load failed — user stays on login form */ });

    return () => { subRef.current?.unsubscribe(); };
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
    if (authed) refresh().finally(() => setDataLoading(false));
  }, [authed, refresh]);

  if (!authed) return <LoginScreen />;

  if (dataLoading) return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'32px', height:'32px', border:'4px solid #e2e8f0', borderTopColor:'#1A6ECC', borderRadius:'50%', animation:'spin .8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

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
