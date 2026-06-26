'use client';

import { useEffect, useState, useCallback } from 'react';
import { CrmShell } from '@/components/crm/CrmShell';
import { OneCardView } from '@/components/crm/OneCardView';
import { KanbanView } from '@/components/crm/KanbanView';
import { ListView } from '@/components/crm/ListView';
import { ContactDrawer } from '@/components/crm/ContactDrawer';
import {
  fetchContacts, fetchStages, fetchTeam, fetchSequences, fetchVoiceAgents,
} from '@/lib/crm/data';
import type { Contact, Stage, TeamMember, Sequence, VoiceAgent, CrmView } from '@/lib/crm/types';

export default function CrmPage() {
  const [view, setView] = useState<CrmView>('onecard');
  const [contacts, setContacts]     = useState<Contact[]>([]);
  const [stages, setStages]         = useState<Stage[]>([]);
  const [team, setTeam]             = useState<TeamMember[]>([]);
  const [sequences, setSequences]   = useState<Sequence[]>([]);
  const [agents, setAgents]         = useState<VoiceAgent[]>([]);
  const [loading, setLoading]       = useState(true);
  const [drawerContact, setDrawerContact] = useState<Contact | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const refresh = useCallback(async () => {
    const [c, s, t, seq, ag] = await Promise.all([
      fetchContacts(), fetchStages(), fetchTeam(), fetchSequences(), fetchVoiceAgents(),
    ]);
    setContacts(c);
    setStages(s);
    setTeam(t);
    setSequences(seq);
    setAgents(ag);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  function openNew() {
    setDrawerContact(null);
    setDrawerOpen(true);
  }

  function openContact(c: Contact) {
    setDrawerContact(c);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerContact(null);
  }

  async function onSaved() {
    await refresh();
    closeDrawer();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
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
