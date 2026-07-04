export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** A Date `daysFromNow` days out at the given local hour. */
export function at(daysFromNow: number, hour: number, minute = 0): Date {
  const d = addDays(new Date(), daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function fmtRange(startsAt: string, endsAt: string): string {
  return `${fmtDay(startsAt)} · ${fmtTime(startsAt)} – ${fmtTime(endsAt)}`;
}

/** "Today", "Tomorrow", or "Sat, Jul 11". */
export function relDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return fmtDay(iso);
}

export function timeAgo(iso: string): string {
  const secs = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDay(iso);
}

/** Events archive 24h after they end. */
export function isArchivable(endsAt: string): boolean {
  return Date.now() > new Date(endsAt).getTime() + 24 * 3600 * 1000;
}
