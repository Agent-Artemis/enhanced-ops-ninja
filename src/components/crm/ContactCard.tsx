'use client';

import type { Contact, Stage } from '@/lib/crm/types';

interface Props {
  contact: Contact;
  stages: Stage[];
  onClick: () => void;
  actions?: React.ReactNode;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}

export function ContactCard({
  contact, stages, onClick, actions,
  draggable = false, onDragStart, onDragEnd, isDragging = false,
}: Props) {
  const stage = stages.find(s => s.id === contact.stage_id);
  const lastNote = contact.notes?.at(-1);
  const stageColor = stage?.color ?? '#1A6ECC';

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        background: '#FFFEF7',
        border: `1px solid #D6CAAD`,
        borderLeft: `4px solid ${stageColor}`,
        borderRadius: 4,
        boxShadow: isDragging
          ? '0 8px 24px rgba(0,0,0,0.5)'
          : '0 2px 8px rgba(0,0,0,0.35)',
        cursor: draggable ? 'grab' : 'pointer',
        opacity: isDragging ? 0.4 : 1,
        userSelect: 'none',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s, opacity 0.15s',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Header row — stage badge + date */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 12px 6px',
        borderBottom: '1px solid #E2D9C0',
        background: '#FBF8EE',
      }}>
        {stage ? (
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#fff',
            background: stageColor, padding: '2px 7px', borderRadius: 10,
            letterSpacing: '0.03em', textTransform: 'uppercase',
          }}>
            {stage.name}
          </span>
        ) : <span />}
        {contact.next_action_date && (
          <span style={{ fontSize: 10, color: '#7C6B4A', fontWeight: 600 }}>
            {contact.next_action_date}
          </span>
        )}
      </div>

      {/* Name */}
      <div style={{
        padding: '8px 12px 6px',
        borderBottom: '1px solid #E2D9C0',
      }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1A1A1A', lineHeight: 1.2 }}>
          {contact.first_name} {contact.last_name ?? ''}
        </p>
      </div>

      {/* Company */}
      {contact.company && (
        <div style={{
          padding: '5px 12px',
          borderBottom: '1px solid #E2D9C0',
        }}>
          <p style={{ margin: 0, fontSize: 12, color: '#4A4A4A' }}>
            {contact.company}
          </p>
        </div>
      )}

      {/* Contact info */}
      {(contact.phone || contact.email) && (
        <div style={{
          padding: '5px 12px',
          borderBottom: lastNote || actions ? '1px solid #E2D9C0' : undefined,
          display: 'flex', gap: 10, flexWrap: 'wrap',
        }}>
          {contact.phone && (
            <span style={{ fontSize: 11, color: '#5A5A5A' }}>📞 {contact.phone}</span>
          )}
          {contact.email && (
            <span style={{ fontSize: 11, color: '#5A5A5A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
              {contact.email}
            </span>
          )}
        </div>
      )}

      {/* Last note */}
      {lastNote && (
        <div style={{
          padding: '5px 12px',
          borderBottom: actions ? '1px solid #E2D9C0' : undefined,
        }}>
          <p style={{ margin: 0, fontSize: 11, color: '#7A6A50', fontStyle: 'italic',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            &ldquo;{lastNote.body}&rdquo;
          </p>
        </div>
      )}

      {/* Actions */}
      {actions && (
        <div style={{ padding: '6px 10px' }} onClick={e => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}
