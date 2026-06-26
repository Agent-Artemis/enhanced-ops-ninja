'use client';

import { useState } from 'react';
import type { VoiceAgent } from '@/lib/crm/types';
import { upsertVoiceAgent, deleteVoiceAgent } from '@/lib/crm/data';

interface Props {
  agents: VoiceAgent[];
  onRefresh: () => Promise<void>;
}

const EMPTY: Partial<VoiceAgent> = {
  name: '', persona: '', voice: '',
  call_instructions: '', text_instructions: '', email_instructions: '',
};

export function VoiceAgentsView({ agents, onRefresh }: Props) {
  const [selected, setSelected] = useState<Partial<VoiceAgent> | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  function openNew()                 { setSelected(EMPTY); setError(''); }
  function openEdit(a: VoiceAgent)   { setSelected({ ...a }); setError(''); }
  function close()                   { setSelected(null); setError(''); }

  function set(key: keyof VoiceAgent, value: string) {
    setSelected(p => p ? { ...p, [key]: value } : p);
  }

  async function save() {
    if (!selected?.name?.trim()) { setError('Name required'); return; }
    setSaving(true);
    setError('');
    try {
      await upsertVoiceAgent(selected);
      await onRefresh();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this agent?')) return;
    await deleteVoiceAgent(id);
    await onRefresh();
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Agent grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-800">AI Voice Agents</h2>
          <button onClick={openNew}
            className="px-4 py-2 bg-[#1A6ECC] text-white text-sm font-medium rounded-lg hover:bg-[#155fb3] transition-colors">
            + New Agent
          </button>
        </div>

        {agents.length === 0 && (
          <div className="text-center py-24 text-slate-400">
            <p className="text-4xl mb-4">🤖</p>
            <p className="text-sm">No agents yet. Create your first AI voice agent.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map(a => (
            <div key={a.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => openEdit(a)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">{a.name}</h3>
                  {a.voice && <p className="text-xs text-slate-500 mt-0.5">Voice: {a.voice}</p>}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(a.id); }}
                  className="text-slate-300 hover:text-red-500 text-lg leading-none"
                >
                  &times;
                </button>
              </div>
              {a.persona && (
                <p className="text-xs text-slate-500 mt-2 line-clamp-2">{a.persona}</p>
              )}
              <div className="flex gap-2 mt-3">
                {a.call_instructions  && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Call</span>}
                {a.text_instructions  && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Text</span>}
                {a.email_instructions && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Email</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Side panel */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={close} />
          <aside className="w-full max-w-md bg-white border-l border-slate-200 flex flex-col overflow-hidden shrink-0">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">
                {selected.id ? 'Edit Agent' : 'New Agent'}
              </h2>
              <button onClick={close} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Agent Name *</label>
                <input type="text" value={selected.name ?? ''} onChange={e => set('name', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Voice</label>
                <input type="text" value={selected.voice ?? ''} onChange={e => set('voice', e.target.value)}
                  placeholder="e.g. Sarah, Josh, Retell voice ID"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Persona</label>
                <textarea value={selected.persona ?? ''} onChange={e => set('persona', e.target.value)}
                  rows={3} placeholder="Who is this agent? How do they behave?"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Call Instructions</label>
                <textarea value={selected.call_instructions ?? ''} onChange={e => set('call_instructions', e.target.value)}
                  rows={4} placeholder="Script / instructions for outbound calls"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Text Instructions</label>
                <textarea value={selected.text_instructions ?? ''} onChange={e => set('text_instructions', e.target.value)}
                  rows={4} placeholder="Script / instructions for SMS outreach"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email Instructions</label>
                <textarea value={selected.email_instructions ?? ''} onChange={e => set('email_instructions', e.target.value)}
                  rows={4} placeholder="Script / instructions for email outreach"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1A6ECC]" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={close}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 text-sm bg-[#1A6ECC] text-white rounded-lg hover:bg-[#155fb3] disabled:opacity-40 transition-colors">
                {saving ? 'Saving…' : 'Save Agent'}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
