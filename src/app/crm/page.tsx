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

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Module-level singleton — same instance used for both signInWithOtp
// (which stores the PKCE verifier) and the callback handler
let _sb: SupabaseClient | null = null;
function getSb() {
  if (!_sb) _sb = createClient(SB_URL, SB_KEY, { auth: { detectSessionInUrl: true, persistSession: true } });
  return _sb;
}

function isAllowed(email: string) {
  return email.endsWith('@enhancedops.ninja') || email === 'jeff@augeo-hq.com';
}

// Fast localStorage read — no network, used for dojo token passthrough
const SB_STORAGE_KEY = (() => {
  try { return `sb-${new URL(SB_URL).hostname.split('.')[0]}-auth-token`; } catch { return 'sb-supabase-auth-token'; }
})();

function readLocalSession() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SB_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Support both flat format (SDK native) and legacy { currentSession }
    const session = parsed?.access_token ? parsed : (parsed?.currentSession ?? parsed);
    if (!session?.access_token) return null;
    const exp = session?.expires_at ?? parsed?.expiresAt ?? 0;
    if (exp && exp < Date.now() / 1000) return null;
    return session;
  } catch { return null; }
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  // JWT uses base64URL (- and _ instead of + and /) — atob needs standard base64
  const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '=='.slice(0, (4 - b64.length % 4) % 4);
  return JSON.parse(atob(padded));
}

function writeLocalSession(access_token: string, refresh_token: string) {
  if (typeof localStorage === 'undefined') return;
  try {
    const payload = decodeJwtPayload(access_token);
    const exp = payload.exp as number;
    // Write in the flat format Supabase SDK v2 expects so getCrmClient()
    // can read it via auth.getSession() and attach auth headers to queries
    const session = { access_token, refresh_token, token_type: 'bearer', expires_in: 3600, expires_at: exp, user: payload };
    localStorage.setItem(SB_STORAGE_KEY, JSON.stringify(session));
  } catch { /* ignore */ }
}

// ── Login form ────────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function sendLink() {
    if (!email.trim()) return;
    setError('');
    if (!isAllowed(email)) { setError('Access restricted to @enhancedops.ninja accounts.'); return; }
    setLoading(true);
    try {
      const { error: err } = await getSb().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: 'https://crm.enhancedops.ninja' },
      });
      if (err) throw err;
      setSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send link');
    } finally { setLoading(false); }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0A0A0C 0%, #0E1118 50%, #0A0D14 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 360,
        background: '#111318',
        borderRadius: 16,
        boxShadow: '0 0 0 1px rgba(26,110,204,0.2), 0 24px 48px rgba(0,0,0,0.6)',
        padding: '40px 32px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>🥷</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#E2E8F0', margin: '0 0 4px' }}>
            Ninja CRM
          </h1>
          <p style={{ fontSize: 13, color: '#546070', margin: 0 }}>Sign in to continue</p>
        </div>
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📬</div>
            <p style={{ fontWeight: 600, color: '#E2E8F0', margin: '0 0 8px' }}>Check your email</p>
            <p style={{ fontSize: 13, color: '#546070', margin: 0 }}>
              Magic link sent to <strong style={{ color: '#94A3B8' }}>{email}</strong>
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#546070', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Email
              </label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendLink()}
                placeholder="you@enhancedops.ninja"
                style={{
                  width: '100%',
                  background: '#0A0C10',
                  border: '1px solid rgba(26,110,204,0.25)',
                  borderRadius: 8, padding: '10px 12px',
                  fontSize: 14, outline: 'none',
                  color: '#E2E8F0', boxSizing: 'border-box',
                }}
              />
            </div>
            {error && (
              <p style={{
                fontSize: 12, color: '#EF4444',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                padding: '8px 12px', borderRadius: 6, margin: 0,
              }}>
                {error}
              </p>
            )}
            <button
              type="button" onClick={sendLink} disabled={loading}
              style={{
                background: loading ? '#0F3D7A' : '#1A6ECC',
                color: '#fff', border: 'none', borderRadius: 8,
                padding: 12, fontSize: 14, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1, transition: 'all 0.15s',
              }}
            >
              {loading ? 'Sending…' : 'Send Magic Link'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'32px', height:'32px', border:'4px solid #e2e8f0', borderTopColor:'#1A6ECC', borderRadius:'50%', animation:'spin .8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CrmPage() {
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
    async function init() {
      const sb = getSb();

      // 1. Dojo token passthrough — hash fragment (#access_token=...)
      //    Write to localStorage immediately (fast, no network) so readLocalSession finds it.
      //    SDK's detectSessionInUrl also handles this automatically via onAuthStateChange.
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

      // 2. Fast path — read from localStorage (zero network calls)
      const local = readLocalSession();
      if (local && isAllowed(local.user?.email ?? '')) {
        setAuthed(true);
        return;
      }

      // 3. Let the SDK handle ?code= callback (PKCE) and session refresh
      // onAuthStateChange fires when magic link code is exchanged
      const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
        const em = session?.user?.email ?? '';
        setAuthed(!!session && isAllowed(em));
      });
      subRef.current = sub.subscription;

      // getSession triggers PKCE code exchange if ?code= is in URL
      const { data } = await sb.auth.getSession().catch(() => ({ data: { session: null } }));
      const em = data.session?.user?.email ?? '';
      if (data.session && isAllowed(em)) setAuthed(true);
    }

    init();
    return () => { subRef.current?.unsubscribe(); };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [c, s, t, seq, ag] = await Promise.all([
        fetchContacts(), fetchStages(), fetchTeam(), fetchSequences(), fetchVoiceAgents(),
      ]);
      setContacts(c); setStages(s); setTeam(t); setSequences(seq); setAgents(ag);
    } catch { /* data fetch failed — leave current state, don't force logout */ }
  }, []);

  useEffect(() => {
    if (authed) refresh().finally(() => setDataLoading(false));
  }, [authed, refresh]);

  if (!authed) return <LoginScreen />;
  if (dataLoading) return <Spinner />;

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
