import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ME_ID, useStore } from './store';
import type { PetEvent } from './types';

const state = () => useStore.getState();

beforeEach(() => {
  useStore.setState({ placeReviews: {}, favorites: [], events: {}, currentUserId: ME_ID });
});

const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
const mkEvent = (over: Partial<PetEvent>): PetEvent => ({
  id: 'e1',
  hostId: 'u1',
  title: 'Test event',
  description: '',
  coverPhotoUrl: '',
  startsAt: daysFromNow(-8),
  endsAt: daysFromNow(-8),
  venueType: 'public_park',
  lat: 30,
  lng: -97,
  address: '',
  areaLabel: '',
  rsvpMode: 'open',
  status: 'active',
  ...over,
});

describe('addPlaceReview', () => {
  it('adds a trimmed review authored by the current user', () => {
    state().addPlaceReview('p1', 5, '  Great fenced park  ');
    const list = state().placeReviews.p1;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ rating: 5, text: 'Great fenced park', authorId: ME_ID, placeId: 'p1' });
  });

  it('allows multiple reviews on the same place', () => {
    state().addPlaceReview('p1', 5, 'one');
    state().addPlaceReview('p1', 3, 'two');
    expect(state().placeReviews.p1).toHaveLength(2);
  });

  it('ignores invalid input (no rating, blank text, missing place)', () => {
    state().addPlaceReview('p1', 0, 'no rating');
    state().addPlaceReview('p1', 5, '   ');
    state().addPlaceReview('', 5, 'no place');
    expect(state().placeReviews).toEqual({});
  });
});

describe('updatePlaceReview', () => {
  it('updates rating + trimmed text of my own review', () => {
    state().addPlaceReview('p1', 3, 'ok');
    const id = state().placeReviews.p1[0].id;
    state().updatePlaceReview('p1', id, 5, '  better now  ');
    expect(state().placeReviews.p1[0]).toMatchObject({ rating: 5, text: 'better now' });
  });

  it("won't touch a review authored by someone else", () => {
    state().addPlaceReview('p1', 3, 'mine');
    const id = state().placeReviews.p1[0].id;
    useStore.setState({ currentUserId: 'someone-else' });
    state().updatePlaceReview('p1', id, 1, 'hijacked');
    expect(state().placeReviews.p1[0]).toMatchObject({ rating: 3, text: 'mine' });
  });

  it('ignores invalid input', () => {
    state().addPlaceReview('p1', 4, 'keep');
    const id = state().placeReviews.p1[0].id;
    state().updatePlaceReview('p1', id, 0, 'bad');
    state().updatePlaceReview('p1', id, 5, '   ');
    expect(state().placeReviews.p1[0]).toMatchObject({ rating: 4, text: 'keep' });
  });
});

describe('deletePlaceReview', () => {
  it('removes my review and prunes the place key when empty', () => {
    state().addPlaceReview('p1', 4, 'bye');
    const id = state().placeReviews.p1[0].id;
    state().deletePlaceReview('p1', id);
    expect(state().placeReviews.p1).toBeUndefined();
  });

  it('keeps other reviews on the place', () => {
    state().addPlaceReview('p1', 4, 'first');
    state().addPlaceReview('p1', 2, 'second');
    const id = state().placeReviews.p1[0].id;
    state().deletePlaceReview('p1', id);
    expect(state().placeReviews.p1).toHaveLength(1);
    expect(state().placeReviews.p1[0].text).toBe('second');
  });

  it("won't delete a review authored by someone else", () => {
    state().addPlaceReview('p1', 4, 'mine');
    const id = state().placeReviews.p1[0].id;
    useStore.setState({ currentUserId: 'someone-else' });
    state().deletePlaceReview('p1', id);
    expect(state().placeReviews.p1).toHaveLength(1);
  });
});

describe('toggleFavorite', () => {
  it('adds an event to favorites (most recent first)', () => {
    state().toggleFavorite('e1');
    state().toggleFavorite('e2');
    expect(state().favorites).toEqual(['e2', 'e1']);
  });

  it('removes an event when toggled again', () => {
    state().toggleFavorite('e1');
    state().toggleFavorite('e1');
    expect(state().favorites).toEqual([]);
  });
});

describe('archiveSweep with recurring events', () => {
  it('rolls an over recurring event forward and keeps it active', () => {
    useStore.setState({ events: { e1: mkEvent({ recurrence: 'weekly' }) } });
    state().archiveSweep();
    const ev = state().events.e1;
    expect(ev.status).toBe('active');
    expect(new Date(ev.startsAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('archives an over non-recurring event as before', () => {
    useStore.setState({ events: { e1: mkEvent({}) } });
    state().archiveSweep();
    expect(state().events.e1.status).toBe('archived');
  });

  it('archives (does not resurrect) a cancelled recurring series', () => {
    useStore.setState({ events: { e1: mkEvent({ recurrence: 'weekly', status: 'cancelled' }) } });
    state().archiveSweep();
    expect(state().events.e1.status).toBe('archived');
  });

  it('leaves a future recurring event untouched', () => {
    const future = daysFromNow(3);
    useStore.setState({
      events: { e1: mkEvent({ recurrence: 'weekly', startsAt: future, endsAt: future }) },
    });
    state().archiveSweep();
    expect(state().events.e1.startsAt).toBe(future);
  });
});

describe('confirmAge / resetAgeGate', () => {
  it('flips the one-time age-confirmation flag', () => {
    useStore.setState({ ageConfirmed: false });
    expect(state().ageConfirmed).toBe(false);
    state().confirmAge();
    expect(state().ageConfirmed).toBe(true);
  });

  it('resetAgeGate clears the flag (dev re-test helper)', () => {
    state().confirmAge();
    state().resetAgeGate();
    expect(state().ageConfirmed).toBe(false);
  });
});

// Regression guards: the mock "backend liveness" setTimeout fakes were retired
// once host approve/decline and comments went real on Supabase. These lock in
// that the mock store no longer auto-responds, even after time passes.
describe('mock store no longer simulates a backend', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('requestJoin leaves the RSVP pending and never auto-approves', () => {
    vi.useFakeTimers();
    const future = daysFromNow(3);
    useStore.setState({
      events: { e1: mkEvent({ id: 'e1', hostId: 'u1', startsAt: future, endsAt: future }) },
      rsvps: [],
      currentUserId: ME_ID,
    });
    state().requestJoin('e1');
    vi.advanceTimersByTime(30000);
    const mine = state().rsvps.find((r) => r.eventId === 'e1' && r.userId === ME_ID);
    expect(mine?.status).toBe('pending_approval');
  });

  it('addComment adds exactly one comment with no canned host reply', () => {
    vi.useFakeTimers();
    const future = daysFromNow(3);
    useStore.setState({
      events: { e1: mkEvent({ id: 'e1', hostId: 'u1', startsAt: future, endsAt: future }) },
      comments: [],
      currentUserId: ME_ID,
    });
    state().addComment('e1', 'Where do we park?');
    vi.advanceTimersByTime(30000);
    const forEvent = state().comments.filter((c) => c.eventId === 'e1');
    expect(forEvent).toHaveLength(1);
    expect(forEvent[0].authorId).toBe(ME_ID);
  });
});
