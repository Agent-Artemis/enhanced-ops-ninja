'use client';

import type { Contact, Stage } from '@/lib/crm/types';
import { appointmentOf, appointmentTimeLabel, appointmentDateString, projectOf, partnerBadgesOf, titleOf } from '@/lib/crm/types';

/** #RRGGBB → rgba() at the given alpha, for a subtle project-color tint over cream. */
function tint(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Props {
  contact: Contact;
  stages: Stage[];
  onClick?: () => void;
  onDoubleClick?: () => void;
  actions?: React.ReactNode;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  justDropped?: boolean;
}

export function ContactCard({
  contact, stages, onClick, onDoubleClick, actions,
  draggable = false, onDragStart, onDragEnd,
  isDragging = false, justDropped = false,
}: Props) {
  const stage      = stages.find(s => s.id === contact.stage_id);
  const lastNote   = contact.notes?.at(-1);
  const stageColor = stage?.color ?? '#1A6BF9';
  // Project / company tag drives the card color. No project = default EON card
  // (rendered exactly as before — the project color becomes the dominant signal).
  const project    = projectOf(contact);
  const accentColor = project ? project.color : stageColor;
  const partnerBadges = partnerBadgesOf(contact);
  const title      = titleOf(contact);

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={isDragging ? undefined : onClick}
      onDoubleClick={isDragging ? undefined : onDoubleClick}
      style={{
        // 3x5 index card — cream stock, pops against dark background.
        // A tagged card gets a subtle wash of its project color over the cream.
        background: project
          ? `linear-gradient(0deg, ${tint(project.color, 0.09)}, ${tint(project.color, 0.09)}), #FFFEF7`
          : '#FFFEF7',
        border: `1px solid #D4CCAA`,
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: 5,
        boxShadow: isDragging
          ? 'none'
          : '0 3px 10px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.3)',
        cursor: draggable ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
        opacity: isDragging ? 0.4 : 1,      // faded in place while drag ghost follows cursor
        userSelect: 'none',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
        // Snap-back animation when card lands
        animation: justDropped ? 'card-snap 0.35s ease-out' : undefined,
        transition: isDragging ? 'none' : 'box-shadow 0.15s, transform 0.15s',
        transform: 'translateZ(0)',          // GPU layer for smooth transitions
      }}
      // Lift on hover — feel like picking up a card
      onMouseEnter={e => {
        if (!isDragging) {
          e.currentTarget.style.transform = 'translateY(-2px) rotate(0.5deg)';
          e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.35)';
        }
      }}
      onMouseLeave={e => {
        if (!isDragging) {
          e.currentTarget.style.transform = 'translateZ(0)';
          e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.3)';
        }
      }}
    >
      {/* Project band — only on tagged cards; the at-a-glance project signal */}
      {project && (
        <div style={{
          background: project.color,
          padding: '4px 11px',
          fontSize: 9, fontWeight: 800, color: '#FFFFFF',
          letterSpacing: '0.08em', textTransform: 'uppercase',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {project.name}
        </div>
      )}

      {/* Header — stage badge + date */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 11px 6px',
        background: '#F8F4E8',
        borderBottom: '1px solid #E2D9C0',
      }}>
        {stage ? (
          <span style={{
            fontSize: 9, fontWeight: 800, color: '#fff',
            background: stageColor, padding: '2px 7px',
            borderRadius: 10, letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            {stage.name}
          </span>
        ) : <span />}
        {contact.next_action_date && (() => {
          // Show the appointment time only while the card is filed on that same day
          const appt = appointmentOf(contact);
          const time = appt && appointmentDateString(appt) === contact.next_action_date
            ? appointmentTimeLabel(appt) : null;
          return (
            <span style={{ fontSize: 10, color: '#7C6B4A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              {time && (
                <span style={{
                  background: '#1A6BF9', color: '#fff', borderRadius: 8,
                  padding: '1px 6px', fontSize: 9, fontWeight: 800, letterSpacing: '0.02em',
                }}>
                  {time}
                </span>
              )}
              {contact.next_action_date}
            </span>
          );
        })()}
      </div>

      {/* Name line */}
      <div style={{ padding: '8px 11px 6px', borderBottom: '1px solid #E2D9C0' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1A1A1A', lineHeight: 1.2 }}>
          {contact.first_name} {contact.last_name ?? ''}
        </p>
        {/* Partner badges — muted pills, one per partner tag; both can show at once */}
        {partnerBadges.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
            {partnerBadges.map(b => (
              <span key={b.label} style={{
                fontSize: 9, fontWeight: 700, color: '#fff',
                background: b.color, padding: '2px 7px', borderRadius: 10,
                letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap',
              }}>
                <span style={{ marginRight: 3, opacity: 0.9 }}>{b.glyph}</span>
                {b.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Company line — with the job title beneath it (title omitted when empty) */}
      {(contact.company || title) && (
        <div style={{ padding: '5px 11px', borderBottom: '1px solid #E2D9C0' }}>
          {contact.company && <p style={{ margin: 0, fontSize: 12, color: '#3A3520' }}>{contact.company}</p>}
          {title && (
            <p style={{ margin: contact.company ? '2px 0 0' : 0, fontSize: 11, color: '#7A6A50' }}>
              {title}
            </p>
          )}
        </div>
      )}

      {/* Contact info line */}
      {(contact.phone || contact.email) && (
        <div style={{
          padding: '5px 11px', display: 'flex', gap: 10, flexWrap: 'wrap',
          borderBottom: lastNote || actions ? '1px solid #E2D9C0' : undefined,
        }}>
          {contact.phone && <span style={{ fontSize: 11, color: '#5A5040' }}>📞 {contact.phone}</span>}
          {contact.email && (
            <span style={{
              fontSize: 11, color: '#5A5040',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180,
            }}>
              {contact.email}
            </span>
          )}
        </div>
      )}

      {/* Last note line */}
      {lastNote && (
        <div style={{
          padding: '5px 11px',
          borderBottom: actions ? '1px solid #E2D9C0' : undefined,
        }}>
          <p style={{
            margin: 0, fontSize: 11, color: '#7A6A50', fontStyle: 'italic',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            &ldquo;{lastNote.body}&rdquo;
          </p>
        </div>
      )}

      {/* Quick actions */}
      {actions && (
        <div style={{ padding: '6px 10px' }} onClick={e => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}
