import { describe, expect, it } from 'vitest';

import { DEFAULT_FILTERS, rankDiscoverEvents } from './filters';
import type { PetEvent } from './types';

const CENTER = { lat: 30.27, lng: -97.74 };
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

const ev = (over: Partial<PetEvent>): PetEvent => ({
  id: 'e',
  hostId: 'h',
  title: 't',
  description: '',
  coverPhotoUrl: '',
  startsAt: inDays(2),
  endsAt: inDays(2),
  venueType: 'public_park',
  lat: 30.27,
  lng: -97.74,
  address: '',
  areaLabel: '',
  rsvpMode: 'open',
  status: 'active',
  ...over,
});

describe('rankDiscoverEvents', () => {
  it('keeps active, future, in-radius events and drops the rest', () => {
    const events = [
      ev({ id: 'ok' }),
      ev({ id: 'past', startsAt: inDays(-2), endsAt: inDays(-2) }),
      ev({ id: 'cancelled', status: 'cancelled' }),
      ev({ id: 'far', lat: 40.71, lng: -74.0 }), // NYC — well outside 15mi
    ];
    const out = rankDiscoverEvents(events, CENTER, DEFAULT_FILTERS);
    expect(out.map((i) => i.event.id)).toEqual(['ok']);
    expect(out[0].goingCount).toBe(0);
  });

  it('breed filter includes all-breeds events plus the chosen breed', () => {
    const events = [
      ev({ id: 'golden', breedFocus: 'Golden Retriever' }),
      ev({ id: 'all' }),
      ev({ id: 'corgi', breedFocus: 'Corgi' }),
    ];
    const out = rankDiscoverEvents(events, CENTER, { ...DEFAULT_FILTERS, breed: 'Golden Retriever' });
    expect(out.map((i) => i.event.id).sort()).toEqual(['all', 'golden']);
  });

  it('venue filter keeps only selected venue types', () => {
    const events = [
      ev({ id: 'park', venueType: 'public_park' }),
      ev({ id: 'yard', venueType: 'home_backyard' }),
    ];
    const out = rankDiscoverEvents(events, CENTER, { ...DEFAULT_FILTERS, venues: ['home_backyard'] });
    expect(out.map((i) => i.event.id)).toEqual(['yard']);
  });

  it('nearest sort orders by distance', () => {
    const near = ev({ id: 'near', lat: 30.28, lng: -97.74 });
    const far = ev({ id: 'far', lat: 30.35, lng: -97.74 });
    const out = rankDiscoverEvents([far, near], CENTER, {
      ...DEFAULT_FILTERS,
      sort: 'nearest',
      radiusMi: 50,
    });
    expect(out.map((i) => i.event.id)).toEqual(['near', 'far']);
  });

  it('applies going counts from the map and defaults missing ones to 0', () => {
    const out = rankDiscoverEvents([ev({ id: 'a' }), ev({ id: 'b' })], CENTER, DEFAULT_FILTERS, {
      a: 5,
    });
    const byId = Object.fromEntries(out.map((i) => [i.event.id, i.goingCount]));
    expect(byId).toEqual({ a: 5, b: 0 });
  });

  it('popular sort orders by going count', () => {
    const out = rankDiscoverEvents(
      [ev({ id: 'quiet' }), ev({ id: 'busy' })],
      CENTER,
      { ...DEFAULT_FILTERS, sort: 'popular' },
      { busy: 9, quiet: 1 },
    );
    expect(out.map((i) => i.event.id)).toEqual(['busy', 'quiet']);
  });

  it('has-spots filter counts going RSVPs against capacity', () => {
    const events = [ev({ id: 'full', capacity: 2 }), ev({ id: 'open', capacity: 5 })];
    const out = rankDiscoverEvents(events, CENTER, { ...DEFAULT_FILTERS, hasSpots: true }, {
      full: 2,
      open: 2,
    });
    expect(out.map((i) => i.event.id)).toEqual(['open']);
  });
});
