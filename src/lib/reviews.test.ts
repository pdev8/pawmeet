import { describe, expect, it } from 'vitest';

import { type PlaceReview } from './places';
import { blendedRating, mergeReviews, stars, type CommunityReview } from './reviews';

const mkReview = (over: Partial<CommunityReview> = {}): CommunityReview => ({
  id: 'r1',
  authorId: 'me',
  authorName: 'Paul',
  authorAvatar: 'http://a/me.png',
  rating: 5,
  text: 'Great',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

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
  it('lists real reviews first (newest first), demo reviews after', () => {
    const community = [
      mkReview({ id: 'r1', text: 'older', createdAt: '2026-01-01T00:00:00.000Z' }),
      mkReview({ id: 'r2', text: 'newer', createdAt: '2026-02-01T00:00:00.000Z', authorId: 'sam', authorName: 'Sam' }),
    ];
    const out = mergeReviews(community, demo, 'me');

    expect(out).toHaveLength(3);
    expect(out[0].reviewId).toBe('r2'); // newest real review first
    expect(out[2].author).toBe('Sam'); // demo review last
    expect(out[2].mine).toBeUndefined();
  });

  it('flags my own review as mine and labels it "You"', () => {
    const [mine] = mergeReviews([mkReview({ authorId: 'me' })], [], 'me');
    expect(mine.mine).toBe(true);
    expect(mine.author).toBe('You');
  });

  it('shows another user’s name and does not flag it mine', () => {
    const [other] = mergeReviews([mkReview({ authorId: 'sam', authorName: 'Sam' })], [], 'me');
    expect(other.mine).toBe(false);
    expect(other.author).toBe('Sam');
  });

  it('uses a relative timestamp, not "Just now"', () => {
    const [r] = mergeReviews([mkReview({ createdAt: '2026-01-01T00:00:00.000Z' })], [], 'me');
    expect(r.when).not.toBe('Just now');
    expect(typeof r.when).toBe('string');
  });

  it('returns just the demo reviews when there are no real ones', () => {
    expect(mergeReviews([], demo, 'me')).toEqual(demo);
  });
});

describe('blendedRating', () => {
  it('returns the base when there are no reviews at all', () => {
    expect(blendedRating(4.2, 0, [])).toBe(4.2);
  });

  it('equals the base when only demo reviews exist', () => {
    expect(blendedRating(4.0, 3, [])).toBe(4.0);
  });

  it('count-weights the demo aggregate with the real reviews', () => {
    // (4.0 * 2 demo + one 5-star real) / 3 = 13/3
    expect(blendedRating(4.0, 2, [mkReview({ rating: 5 })])).toBeCloseTo(13 / 3);
  });

  it('averages the real reviews alone when there are no demo reviews', () => {
    expect(blendedRating(4.0, 0, [mkReview({ rating: 2 }), mkReview({ rating: 4 })])).toBe(3);
  });
});
