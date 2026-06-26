'use client';

import type { Contact, Stage } from '@/lib/crm/types';

interface Props {
  contact: Contact;
  stages: Stage[];
  onClick: () => void;
  actions?: React.ReactNode;
}

export function ContactCard({ contact, stages, onClick, actions }: Props) {
  const stage = stages.find(s => s.id === contact.stage_id);
  const lastNote = contact.notes?.at(-1);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border-l-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4 flex flex-col gap-1"
      style={{ borderLeftColor: stage?.color ?? '#1A6ECC' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 truncate">
            {contact.first_name} {contact.last_name ?? ''}
          </p>
          {contact.company && (
            <p className="text-xs text-slate-500 truncate">{contact.company}</p>
          )}
        </div>
        {stage && (
          <span
            className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium text-white"
            style={{ backgroundColor: stage.color }}
          >
            {stage.name}
          </span>
        )}
      </div>

      <div className="flex gap-4 text-xs text-slate-500 mt-1">
        {contact.phone && <span>{contact.phone}</span>}
        {contact.email && <span className="truncate">{contact.email}</span>}
      </div>

      {contact.next_action_date && (
        <p className="text-xs text-[#1A6ECC] font-medium mt-0.5">
          Due: {contact.next_action_date}
        </p>
      )}

      {lastNote && (
        <p className="text-xs text-slate-400 italic truncate mt-0.5">
          &ldquo;{lastNote.body}&rdquo;
        </p>
      )}

      {actions && <div className="mt-2">{actions}</div>}
    </div>
  );
}
