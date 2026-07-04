import { type PlaceReview } from './places';
import type { StoredPlaceReview, User } from './types';

/**
 * A review as rendered in the place sheet. Extends the demo `PlaceReview` shape
 * with the fields the UI needs to offer edit/delete on the current user's own
 * reviews (`reviewId` + `mine`).
 */
export interface DisplayReview extends PlaceReview {
  reviewId?: string;
  mine?: boolean;
}

const FULL_STAR = '★';
const EMPTY_STAR = '☆';

/** "★★★★☆" for a 0–5 rating (rounded, clamped so it never over/underflows). */
export function stars(rating: number): string {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return FULL_STAR.repeat(full) + EMPTY_STAR.repeat(5 - full);
}

/**
 * My reviews (newest first, flagged `mine` with their stored id) above the demo
 * community reviews. Author name/avatar resolve from the users map, falling back
 * to "You" if the author isn't found.
 */
export function mergeReviews(
  mine: StoredPlaceReview[],
  demo: PlaceReview[],
  users: Record<string, User>,
): DisplayReview[] {
  const mineDisplay: DisplayReview[] = [...mine].reverse().map((r) => ({
    reviewId: r.id,
    mine: true,
    author: users[r.authorId]?.displayName ?? 'You',
    avatarUrl: users[r.authorId]?.avatarUrl ?? '',
    rating: r.rating,
    text: r.text,
    when: 'Just now',
  }));
  return [...mineDisplay, ...demo];
}

/**
 * Blend the demo aggregate rating with my own reviews for the headline number:
 * a count-weighted mean. With no reviews at all it's just the base rating.
 */
export function blendedRating(
  base: number,
  demoCount: number,
  mine: StoredPlaceReview[],
): number {
  const total = demoCount + mine.length;
  if (total === 0) return base;
  const mineSum = mine.reduce((sum, r) => sum + r.rating, 0);
  return (base * demoCount + mineSum) / total;
}
