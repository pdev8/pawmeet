import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_FILTERS } from './filters';
import { ME_ID, useStore } from './store';

const state = () => useStore.getState();

beforeEach(() => {
  useStore.setState({ placeReviews: {}, favorites: [], savedSearches: [], currentUserId: ME_ID });
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

describe('saveSearch / deleteSavedSearch', () => {
  const austin = { lat: 30.27, lng: -97.74 };

  it('saves a named search (newest first) with a trimmed label', () => {
    state().saveSearch('  Goldens near home  ', DEFAULT_FILTERS, austin, 'Austin, TX');
    const list = state().savedSearches;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ label: 'Goldens near home', centerLabel: 'Austin, TX' });
    expect(list[0].filters).toEqual(DEFAULT_FILTERS);
  });

  it('prepends newer searches', () => {
    state().saveSearch('first', DEFAULT_FILTERS, austin, 'Austin, TX');
    state().saveSearch('second', DEFAULT_FILTERS, austin, 'Austin, TX');
    expect(state().savedSearches.map((s) => s.label)).toEqual(['second', 'first']);
  });

  it('ignores a blank label', () => {
    state().saveSearch('   ', DEFAULT_FILTERS, austin, 'Austin, TX');
    expect(state().savedSearches).toHaveLength(0);
  });

  it('deletes by id', () => {
    state().saveSearch('keep', DEFAULT_FILTERS, austin, 'Austin, TX');
    state().saveSearch('drop', DEFAULT_FILTERS, austin, 'Austin, TX');
    const dropId = state().savedSearches.find((s) => s.label === 'drop')!.id;
    state().deleteSavedSearch(dropId);
    expect(state().savedSearches.map((s) => s.label)).toEqual(['keep']);
  });
});
