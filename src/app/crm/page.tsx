'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CrmShell } from '@/components/crm/CrmShell';
import { OneCardView } from '@/components/crm/OneCardView';
import { KanbanView } from '@/components/crm/KanbanView';
import { ListView } from '@/components/crm/ListView';
import { ContactDrawer } from '@/components/crm/ContactDrawer';
import {
  fetchContacts, fetchStages, fetchTeam, fetchSequences, fetchVoiceAgents,
} from '@/lib/crm/data';
import type { Contact, Stage, TeamMember, Sequence, VoiceAgent, CrmView } from '@/lib/crm/types';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Inline login — shown when no session ─────────────────────────────────────
function LoginScreen() {
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const allowed = email.endsWith('@enhancedops.ninja') || email === 'jeff@augeo-hq.com';
    if (!allowed) { setError('Access restricted to @enhancedops.ninja accounts.'); return; }
    setLoading(true);
    const { error: err } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'https://crm.enhancedops.ninja' },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '360px', background: '#fff', borderRadius: '16px', boxShadow: '0 1px 8px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', padding: '40px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🥷</div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', margin: 0 }}>EON CRM</h1>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>Sign in to continue</p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📬</div>
            <p style={{ fontWeight: 600, color: '#1e293b' }}>Check your email</p>
            <p style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>
              Magic link sent to <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@enhancedops.ninja"
              required
              style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }}
            />
            {error && (
              <p style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px' }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !email}
              style={{ width: '100%', background: loading || !email ? '#93c5fd' : '#1A6ECC', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: 600, cursor: loading || !email ? 'default' : 'pointer' }}
            >
              {loading ? 'Sending…' : 'Send Magic Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Main CRM page ─────────────────────────────────────────────────────────────
export default function CrmPage() {
  const [authed, setAuthed]             = useState<boolean | null>(null);
  const [view, setView]                 = useState<CrmView>('onecard');
  const [contacts, setContacts]         = useState<Contact[]>([]);
  const [stages, setStages]             = useState<Stage[]>([]);
  const [team, setTeam]                 = useState<TeamMember[]>([]);
  const [sequences, setSequences]       = useState<Sequence[]>([]);
  const [agents, setAgents]             = useState<VoiceAgent[]>([]);
  const [loading, setLoading]           = useState(true);
  const [drawerContact, setDrawerContact] = useState<Contact | null>(null);
  const [drawerOpen, setDrawerOpen]     = useState(false);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email ?? '';
      const ok = email.endsWith('@enhancedops.ninja') || email === 'jeff@augeo-hq.com';
      setAuthed(!!data.session && ok);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      const email = session?.user?.email ?? '';
      const ok = email.endsWith('@enhancedops.ninja') || email === 'jeff@augeo-hq.com';
      setAuthed(!!session && ok);
    });
    return () => sub.subscription.unsubscribe();
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
    if (authed) refresh().finally(() => setLoading(false));
  }, [authed, refresh]);

  // Still checking auth
  if (authed === null) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '4px solid #e2e8f0', borderTopColor: '#1A6ECC', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!authed) return <LoginScreen />;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '4px solid #e2e8f0', borderTopColor: '#1A6ECC', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

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
