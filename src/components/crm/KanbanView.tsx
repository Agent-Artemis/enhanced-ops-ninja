'use client';

import { useState } from 'react';
import type { Contact, Stage } from '@/lib/crm/types';
import { ContactCard } from './ContactCard';
import { upsertContact } from '@/lib/crm/data';

interface Props {
  contacts: Contact[];
  stages: Stage[];
  onOpen: (c: Contact) => void;
  onRefresh: () => Promise<void>;
}

export function KanbanView({ contacts, stages, onOpen, onRefresh }: Props) {
  const [dragging, setDragging] = useState<string | null>(null);

  function contactsForStage(stageId: string): Contact[] {
    return contacts.filter(c => c.stage_id === stageId);
  }

  const unassigned = contacts.filter(c => !c.stage_id);

  function onDragStart(e: React.DragEvent, contactId: string) {
    setDragging(contactId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  async function onDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    if (!dragging) return;
    await upsertContact({ id: dragging, stage_id: stageId });
    setDragging(null);
    await onRefresh();
  }

  function onDragEnd() {
    setDragging(null);
  }

  const allStages = [
    ...stages,
    ...(unassigned.length > 0 ? [{ id: '__unassigned__', name: 'Unassigned', position: -1, color: '#94a3b8', created_at: '' }] : []),
  ];

  return (
    <div className="flex gap-4 p-6 overflow-x-auto min-h-[calc(100vh-4rem)]">
      {allStages.map(stage => {
        const cards = stage.id === '__unassigned__' ? unassigned : contactsForStage(stage.id);
        return (
          <div
            key={stage.id}
            className="flex flex-col w-72 shrink-0"
            onDragOver={onDragOver}
            onDrop={e => onDrop(e, stage.id)}
          >
            {/* Column header */}
            <div
              className="flex items-center justify-between px-3 py-2 rounded-t-lg text-white text-sm font-semibold"
              style={{ backgroundColor: stage.color }}
            >
              <span>{stage.name}</span>
              <span className="text-xs opacity-80">{cards.length}</span>
            </div>

            {/* Cards */}
            <div className="flex-1 bg-slate-100 rounded-b-lg p-2 flex flex-col gap-2 min-h-40">
              {cards.map(c => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={e => onDragStart(e, c.id)}
                  onDragEnd={onDragEnd}
                  className={`transition-opacity ${dragging === c.id ? 'opacity-40' : ''}`}
                >
                  <ContactCard
                    contact={c}
                    stages={stages}
                    onClick={() => onOpen(c)}
                  />
                </div>
              ))}
              {cards.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-400 py-8">
                  Drop here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
