import { addDays } from './dates';
import { distanceMi } from './geo';
import { goingRsvps, spotsLeft } from './selectors';
import type { LatLng, Pet, PetEvent, Rsvp, User, VenueType } from './types';

export type DateWindow = 'today' | 'weekend' | '7d' | '30d';
export type SortMode = 'soonest' | 'nearest' | 'popular';

export interface Filters {
  radiusMi: number;
  dateWindow: DateWindow;
  breed: string | null;
  venues: VenueType[];
  hasSpots: boolean;
  sort: SortMode;
}

export const DEFAULT_FILTERS: Filters = {
  radiusMi: 15,
  dateWindow: '30d',
  breed: null,
  venues: [],
  hasSpots: false,
  sort: 'soonest',
};

export function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.radiusMi !== DEFAULT_FILTERS.radiusMi) n++;
  if (f.dateWindow !== DEFAULT_FILTERS.dateWindow) n++;
  if (f.breed) n++;
  if (f.venues.length > 0) n++;
  if (f.hasSpots) n++;
  return n;
}

function windowEnd(w: DateWindow): Date {
  const now = new Date();
  switch (w) {
    case 'today': {
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    case 'weekend': {
      // Through the end of the upcoming (or current) Sunday.
      const end = new Date(now);
      const day = end.getDay(); // 0 = Sunday
      const daysUntilSunday = day === 0 ? 0 : 7 - day;
      end.setDate(end.getDate() + daysUntilSunday);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    case '7d':
      return addDays(now, 7);
    case '30d':
      return addDays(now, 30);
  }
}

interface StateSlice {
  users: Record<string, User>;
  pets: Record<string, Pet>;
  events: Record<string, PetEvent>;
  rsvps: Rsvp[];
  comments: { eventId: string; deletedBy?: 'author' | 'host' }[];
  currentUserId: string;
}

export interface DiscoveryItem {
  event: PetEvent;
  distanceMi: number;
  goingCount: number;
}

export function discoverEvents(
  s: StateSlice,
  center: LatLng,
  f: Filters,
): DiscoveryItem[] {
  const now = Date.now();
  const end = windowEnd(f.dateWindow).getTime();

  const items: DiscoveryItem[] = [];
  for (const ev of Object.values(s.events)) {
    if (ev.status !== 'active') continue;
    const starts = new Date(ev.startsAt).getTime();
    if (starts < now || starts > end) continue;
    const dist = distanceMi(center, { lat: ev.lat, lng: ev.lng });
    if (dist > f.radiusMi) continue;
    // Breed filter is inclusive: breed-focused matches OR all-breeds events.
    if (f.breed && ev.breedFocus && ev.breedFocus !== f.breed) continue;
    if (f.venues.length > 0 && !f.venues.includes(ev.venueType)) continue;
    if (f.hasSpots) {
      const left = spotsLeft(s, ev);
      if (left !== null && left <= 0) continue;
    }
    items.push({
      event: ev,
      distanceMi: dist,
      goingCount: goingRsvps(s, ev.id).length,
    });
  }

  items.sort((a, b) => {
    switch (f.sort) {
      case 'nearest':
        return a.distanceMi - b.distanceMi;
      case 'popular':
        return b.goingCount - a.goingCount;
      default:
        return a.event.startsAt.localeCompare(b.event.startsAt);
    }
  });
  return items;
}
