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

export default function CrmPage() {
  const [authed, setAuthed]           = useState<boolean | null>(null);
  const [view, setView]               = useState<CrmView>('onecard');
  const [contacts, setContacts]       = useState<Contact[]>([]);
  const [stages, setStages]           = useState<Stage[]>([]);
  const [team, setTeam]               = useState<TeamMember[]>([]);
  const [sequences, setSequences]     = useState<Sequence[]>([]);
  const [agents, setAgents]           = useState<VoiceAgent[]>([]);
  const [loading, setLoading]         = useState(true);
  const [drawerContact, setDrawerContact] = useState<Contact | null>(null);
  const [drawerOpen, setDrawerOpen]   = useState(false);

  // Check auth first
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email ?? '';
      const allowed =
        email.endsWith('@enhancedops.ninja') || email === 'jeff@augeo-hq.com';
      setAuthed(!!data.session && allowed);
    });

    const { data: listener } = sb.auth.onAuthStateChange((_e, session) => {
      const email = session?.user?.email ?? '';
      const allowed =
        email.endsWith('@enhancedops.ninja') || email === 'jeff@augeo-hq.com';
      setAuthed(!!session && allowed);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [c, s, t, seq, ag] = await Promise.all([
        fetchContacts(), fetchStages(), fetchTeam(), fetchSequences(), fetchVoiceAgents(),
      ]);
      setContacts(c);
      setStages(s);
      setTeam(t);
      setSequences(seq);
      setAgents(ag);
    } catch {
      // session expired or RLS blocked — redirect to login
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    if (authed) refresh().finally(() => setLoading(false));
  }, [authed, refresh]);

  // Redirect to login — use /login not /crm/login because the subdomain
  // rewrite already prepends /crm/, so /login → /crm/login correctly
  useEffect(() => {
    if (authed === false) {
      window.location.href = '/login';
    }
  }, [authed]);

  function openNew()             { setDrawerContact(null); setDrawerOpen(true); }
  function openContact(c: Contact) { setDrawerContact(c); setDrawerOpen(true); }
  function closeDrawer()         { setDrawerOpen(false); setDrawerContact(null); }
  async function onSaved()       { await refresh(); closeDrawer(); }

  // Still checking auth or redirecting
  if (authed === null || authed === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-8 h-8 border-4 border-[#1A6ECC] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-8 h-8 border-4 border-[#1A6ECC] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <CrmShell view={view} onViewChange={setView} onNewCard={openNew} />
      <main className="pt-16">
        {view === 'onecard' && (
          <OneCardView contacts={contacts} stages={stages} onOpen={openContact} onRefresh={refresh} />
        )}
        {view === 'kanban' && (
          <KanbanView contacts={contacts} stages={stages} onOpen={openContact} onRefresh={refresh} />
        )}
        {view === 'list' && (
          <ListView contacts={contacts} stages={stages} onOpen={openContact} />
        )}
      </main>
      <ContactDrawer
        open={drawerOpen}
        contact={drawerContact}
        stages={stages}
        team={team}
        sequences={sequences}
        agents={agents}
        onClose={closeDrawer}
        onSaved={onSaved}
      />
    </>
  );
}
