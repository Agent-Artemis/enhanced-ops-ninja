'use client';

import { useEffect, useState } from 'react';
import { VoiceAgentsView } from '@/components/crm/VoiceAgentsView';
import { fetchVoiceAgents } from '@/lib/crm/data';
import type { VoiceAgent } from '@/lib/crm/types';
import Link from 'next/link';

export default function VoiceAgentsPage() {
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const data = await fetchVoiceAgents();
    setAgents(data);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-16 bg-white border-b border-slate-200 flex items-center px-6 gap-4">
        <Link href="/crm" className="text-sm text-[#1A6ECC] hover:underline">← Back to CRM</Link>
        <span className="text-slate-300">|</span>
        <h1 className="text-lg font-semibold text-slate-800">AI Voice Agents</h1>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[#1A6ECC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <VoiceAgentsView agents={agents} onRefresh={refresh} />
      )}
    </div>
  );
}
