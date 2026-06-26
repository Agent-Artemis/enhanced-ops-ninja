import type { Contact, Bucket } from './types';

export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Determine which filing bucket a contact belongs to based on next_action_date */
export function bucketFor(contact: Contact): Bucket {
  if (!contact.is_active) return 'alpha';
  if (!contact.next_action_date) return 'active';

  const today = new Date();
  const due = parseLocalDate(contact.next_action_date);

  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueMid   = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  if (dueMid <= todayMid) return 'today';

  // same month → day bucket
  if (due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth()) {
    return 'day';
  }

  // future month
  return 'month';
}

/** All contacts due today or overdue */
export function todayStack(contacts: Contact[]): Contact[] {
  const t = todayString();
  return contacts.filter(c => c.is_active && c.next_action_date && c.next_action_date <= t)
    .sort((a, b) => (a.next_action_date ?? '').localeCompare(b.next_action_date ?? ''));
}

/** 1-31 day tabs for the current month with counts */
export function dayTabs(contacts: Contact[]): { day: number; count: number }[] {
  const today = new Date();
  const year  = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDay = today.getDate();

  const counts: Record<number, number> = {};
  for (const c of contacts) {
    if (!c.is_active || !c.next_action_date) continue;
    const d = parseLocalDate(c.next_action_date);
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() > todayDay) {
      counts[d.getDate()] = (counts[d.getDate()] ?? 0) + 1;
    }
  }

  return Array.from({ length: daysInMonth - todayDay }, (_, i) => {
    const day = todayDay + 1 + i;
    return { day, count: counts[day] ?? 0 };
  });
}

/** Future-month tabs with counts */
export function monthTabs(contacts: Contact[]): { month: string; year: number; count: number }[] {
  const today = new Date();
  const thisYear  = today.getFullYear();
  const thisMonth = today.getMonth();

  const counts: Record<string, number> = {};
  for (const c of contacts) {
    if (!c.is_active || !c.next_action_date) continue;
    const d = parseLocalDate(c.next_action_date);
    if (d.getFullYear() > thisYear || (d.getFullYear() === thisYear && d.getMonth() > thisMonth)) {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return Object.entries(counts)
    .map(([key, count]) => {
      const [y, m] = key.split('-').map(Number);
      return { month: MONTH_NAMES[m], year: y, count };
    })
    .sort((a, b) => {
      const ay = a.year * 12 + MONTH_NAMES.indexOf(a.month);
      const by = b.year * 12 + MONTH_NAMES.indexOf(b.month);
      return ay - by;
    });
}

/** Contacts grouped by first letter of last/first name for the alpha drawer */
export function alphaGroups(contacts: Contact[]): Record<string, Contact[]> {
  const groups: Record<string, Contact[]> = {};
  for (const c of contacts) {
    if (c.is_active) continue; // alpha = inactive only
    const letter = ((c.last_name ?? c.first_name ?? '?')[0] ?? '?').toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(c);
  }
  return groups;
}

/** Contacts for a specific day this month */
export function contactsForDay(contacts: Contact[], day: number): Contact[] {
  const today = new Date();
  const year  = today.getFullYear();
  const month = today.getMonth();
  return contacts.filter(c => {
    if (!c.is_active || !c.next_action_date) return false;
    const d = parseLocalDate(c.next_action_date);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  });
}

/** Contacts for a specific future month */
export function contactsForMonth(contacts: Contact[], month: string, year: number): Contact[] {
  const mIdx = MONTH_NAMES.indexOf(month);
  return contacts.filter(c => {
    if (!c.is_active || !c.next_action_date) return false;
    const d = parseLocalDate(c.next_action_date);
    return d.getFullYear() === year && d.getMonth() === mIdx;
  });
}
