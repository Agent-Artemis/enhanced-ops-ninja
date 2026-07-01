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
  const [dragging, setDragging]     = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const unassigned = contacts.filter(c => !c.stage_id);

  const allStages = [
    ...stages,
    ...(unassigned.length > 0
      ? [{ id: '__unassigned__', name: 'Unassigned', position: -1, color: '#374151', created_at: '' }]
      : []),
  ];

  function contactsForStage(stageId: string): Contact[] {
    return stageId === '__unassigned__'
      ? unassigned
      : contacts.filter(c => c.stage_id === stageId);
  }

  function onDragStart(e: React.DragEvent, contactId: string) {
    setDragging(contactId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(stageId);
  }

  async function onDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    if (!dragging) return;
    await upsertContact({ id: dragging, stage_id: stageId === '__unassigned__' ? undefined : stageId });
    setDragging(null);
    setDropTarget(null);
    await onRefresh();
  }

  function onDragEnd() {
    setDragging(null);
    setDropTarget(null);
  }

  return (
    <div style={{
      display: 'flex', gap: 12, padding: '20px 24px',
      overflowX: 'auto', minHeight: 'calc(100vh - 88px)',
      background: '#111111', alignItems: 'flex-start',
    }}>
      {allStages.map(stage => {
        const cards = contactsForStage(stage.id);
        const isTarget = dropTarget === stage.id;

        return (
          <div
            key={stage.id}
            style={{ display: 'flex', flexDirection: 'column', width: 272, flexShrink: 0 }}
            onDragOver={e => onDragOver(e, stage.id)}
            onDragLeave={() => setDropTarget(null)}
            onDrop={e => onDrop(e, stage.id)}
          >
            {/* Column header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px',
              background: stage.color,
              borderRadius: '6px 6px 0 0',
              color: '#fff', fontSize: 13, fontWeight: 600,
            }}>
              <span>{stage.name}</span>
              <span style={{ fontSize: 11, opacity: 0.8 }}>{cards.length}</span>
            </div>

            {/* Cards column */}
            <div style={{
              flex: 1, minHeight: 160,
              background: isTarget ? 'rgba(26,107,249,0.08)' : '#1A1A1A',
              border: isTarget ? '1px solid rgba(26,107,249,0.4)' : '1px solid #2d2d2d',
              borderTop: 'none',
              borderRadius: '0 0 6px 6px',
              padding: 8,
              display: 'flex', flexDirection: 'column', gap: 8,
              transition: 'background 0.12s',
            }}>
              {cards.map(c => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={e => onDragStart(e, c.id)}
                  onDragEnd={onDragEnd}
                  style={{ opacity: dragging === c.id ? 0.3 : 1, transition: 'opacity 0.15s' }}
                >
                  <ContactCard
                    contact={c}
                    stages={stages}
                    onClick={() => onOpen(c)}
                  />
                </div>
              ))}
              {cards.length === 0 && (
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: '#374151', padding: '20px 0',
                  fontStyle: 'italic',
                }}>
                  {isTarget ? 'Drop here' : 'Empty'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
