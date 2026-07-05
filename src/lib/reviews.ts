import { timeAgo } from './dates';
import { type PlaceReview } from './places';

/**
 * A review as rendered in the place sheet. Extends the demo `PlaceReview` shape
 * with the fields the UI needs to offer edit/delete on the current user's own
 * reviews (`reviewId` + `mine`).
 */
export interface DisplayReview extends PlaceReview {
  reviewId?: string;
  mine?: boolean;
}

/** A persisted review from any user, with the author profile resolved. */
export interface CommunityReview {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  rating: number;
  text: string;
  createdAt: string;
}

const FULL_STAR = '★';
const EMPTY_STAR = '☆';

/** "★★★★☆" for a 0–5 rating (rounded, clamped so it never over/underflows). */
export function stars(rating: number): string {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return FULL_STAR.repeat(full) + EMPTY_STAR.repeat(5 - full);
}

/**
 * Real community reviews (newest first, with relative timestamps; my own flagged
 * `mine` and labelled "You" for edit/delete) above the demo community reviews.
 */
export function mergeReviews(
  community: CommunityReview[],
  demo: PlaceReview[],
  myId: string | undefined,
): DisplayReview[] {
  const real: DisplayReview[] = [...community]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => {
      const mine = r.authorId === myId;
      return {
        reviewId: r.id,
        mine,
        author: mine ? 'You' : r.authorName,
        avatarUrl: r.authorAvatar ?? '',
        rating: r.rating,
        text: r.text,
        when: timeAgo(r.createdAt),
      };
    });
  return [...real, ...demo];
}

/**
 * Blend the demo aggregate rating with the real reviews for the headline number:
 * a count-weighted mean. With no reviews at all it's just the base rating.
 */
export function blendedRating(
  base: number,
  demoCount: number,
  community: { rating: number }[],
): number {
  const total = demoCount + community.length;
  if (total === 0) return base;
  const sum = community.reduce((acc, r) => acc + r.rating, 0);
  return (base * demoCount + sum) / total;
}
