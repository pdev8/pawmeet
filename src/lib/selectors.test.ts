import { describe, expect, it } from 'vitest';

import { isFavorite, myFavoriteEvents } from './selectors';
import type { PetEvent } from './types';

const ev = (id: string, status: PetEvent['status'] = 'active'): PetEvent =>
  ({
    id,
    hostId: 'u1',
    title: id,
    description: '',
    coverPhotoUrl: '',
    startsAt: '2026-08-01T10:00:00.000Z',
    endsAt: '2026-08-01T12:00:00.000Z',
    venueType: 'public_park',
    lat: 30,
    lng: -97,
    address: '',
    areaLabel: '',
    rsvpMode: 'open',
    status,
  }) as PetEvent;

const slice = (favorites: string[], events: PetEvent[]) => ({
  users: {},
  pets: {},
  events: Object.fromEntries(events.map((e) => [e.id, e])),
  rsvps: [],
  comments: [],
  currentUserId: 'u1',
  favorites,
});

describe('isFavorite', () => {
  it('reflects membership in the favorites list', () => {
    const s = slice(['e1'], [ev('e1'), ev('e2')]);
    expect(isFavorite(s, 'e1')).toBe(true);
    expect(isFavorite(s, 'e2')).toBe(false);
  });
});

describe('myFavoriteEvents', () => {
  it('returns active favorited events in saved order', () => {
    const s = slice(['e2', 'e1'], [ev('e1'), ev('e2')]);
    expect(myFavoriteEvents(s).map((e) => e.id)).toEqual(['e2', 'e1']);
  });

  it('skips archived favorites and dangling ids', () => {
    const s = slice(['gone', 'e3', 'e1'], [ev('e1'), ev('e3', 'archived')]);
    expect(myFavoriteEvents(s).map((e) => e.id)).toEqual(['e1']);
  });
});
