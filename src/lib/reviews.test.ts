import { describe, expect, it } from 'vitest';

import { type PlaceReview } from './places';
import { blendedRating, mergeReviews, stars } from './reviews';
import type { StoredPlaceReview, User } from './types';

const mkStored = (over: Partial<StoredPlaceReview> = {}): StoredPlaceReview => ({
  id: 'r1',
  placeId: 'p1',
  authorId: 'me',
  rating: 5,
  text: 'Great',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const users: Record<string, User> = {
  me: { id: 'me', displayName: 'Paul', avatarUrl: 'http://a/me.png', homeArea: 'Austin' },
};

const demo: PlaceReview[] = [
  { author: 'Sam', avatarUrl: 'http://a/sam.png', rating: 4, text: 'nice', when: 'last week' },
];

describe('stars', () => {
  it('renders filled + empty stars to a width of 5', () => {
    expect(stars(0)).toBe('☆☆☆☆☆');
    expect(stars(3)).toBe('★★★☆☆');
    expect(stars(5)).toBe('★★★★★');
  });

  it('rounds to the nearest whole star', () => {
    expect(stars(4.4)).toBe('★★★★☆');
    expect(stars(4.5)).toBe('★★★★★');
  });

  it('clamps out-of-range input instead of throwing', () => {
    expect(stars(-2)).toBe('☆☆☆☆☆');
    expect(stars(9)).toBe('★★★★★');
  });
});

describe('mergeReviews', () => {
  it('lists my reviews first (newest first) and flags them for edit/delete', () => {
    const mine = [mkStored({ id: 'r1', text: 'first' }), mkStored({ id: 'r2', text: 'second' })];
    const out = mergeReviews(mine, demo, users);

    expect(out).toHaveLength(3);
    expect(out[0].reviewId).toBe('r2'); // most recently added shows first
    expect(out[0].mine).toBe(true);
    expect(out[0].author).toBe('Paul');
    expect(out[2].author).toBe('Sam'); // demo review last
    expect(out[2].mine).toBeUndefined();
  });

  it('falls back to "You" / blank avatar for an unknown author', () => {
    const out = mergeReviews([mkStored({ authorId: 'ghost' })], [], users);
    expect(out[0].author).toBe('You');
    expect(out[0].avatarUrl).toBe('');
  });

  it('returns just the demo reviews when I have none', () => {
    expect(mergeReviews([], demo, users)).toEqual(demo);
  });
});

describe('blendedRating', () => {
  it('returns the base when there are no reviews at all', () => {
    expect(blendedRating(4.2, 0, [])).toBe(4.2);
  });

  it('equals the base when only demo reviews exist', () => {
    expect(blendedRating(4.0, 3, [])).toBe(4.0);
  });

  it('count-weights the demo aggregate with my reviews', () => {
    // (4.0 * 2 demo + one 5-star of mine) / 3 = 13/3
    expect(blendedRating(4.0, 2, [mkStored({ rating: 5 })])).toBeCloseTo(13 / 3);
  });

  it('averages my reviews alone when there are no demo reviews', () => {
    expect(blendedRating(4.0, 0, [mkStored({ rating: 2 }), mkStored({ rating: 4 })])).toBe(3);
  });
});
