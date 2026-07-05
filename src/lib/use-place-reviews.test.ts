import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));

import { supabase } from './supabase';
import {
  addPlaceReview,
  deletePlaceReview,
  fetchMyPlaceReviews,
  updatePlaceReview,
} from './use-place-reviews';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const auth = supabase.auth as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = supabase.from as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchMyPlaceReviews', () => {
  it('returns [] when signed out', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    expect(await fetchMyPlaceReviews('p1')).toEqual([]);
  });

  it('maps rows to StoredPlaceReview, scoped to place + author', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const order = vi.fn().mockResolvedValue({
      data: [
        { id: 'r1', place_id: 'p1', author_id: 'u1', rating: 4, body: 'Nice', created_at: 't0' },
      ],
      error: null,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = { order };
    chain.eq = vi.fn(() => chain);
    from.mockReturnValue({ select: vi.fn(() => chain) });

    const out = await fetchMyPlaceReviews('p1');

    expect(from).toHaveBeenCalledWith('place_reviews');
    expect(chain.eq).toHaveBeenCalledWith('place_id', 'p1');
    expect(chain.eq).toHaveBeenCalledWith('author_id', 'u1');
    expect(out).toEqual([
      { id: 'r1', placeId: 'p1', authorId: 'u1', rating: 4, text: 'Nice', createdAt: 't0' },
    ]);
  });
});

describe('addPlaceReview', () => {
  it('no-ops on invalid input (before touching the network)', async () => {
    await addPlaceReview('p1', 0, 'x');
    await addPlaceReview('p1', 5, '   ');
    await addPlaceReview('', 5, 'ok');
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('throws when signed out', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    await expect(addPlaceReview('p1', 5, 'Great')).rejects.toThrow('Not signed in');
  });

  it('inserts a trimmed review authored by the signed-in user', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const insert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ insert });

    await addPlaceReview('p1', 5, '  Great park  ');

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ place_id: 'p1', author_id: 'u1', rating: 5, body: 'Great park' }),
    );
  });
});

describe('updatePlaceReview', () => {
  it('no-ops on invalid input', async () => {
    await updatePlaceReview('r1', 0, 'x');
    await updatePlaceReview('r1', 5, '  ');
    expect(from).not.toHaveBeenCalled();
  });

  it('updates rating + trimmed body by id', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update });

    await updatePlaceReview('r1', 3, '  updated  ');

    expect(update).toHaveBeenCalledWith({ rating: 3, body: 'updated' });
    expect(eq).toHaveBeenCalledWith('id', 'r1');
  });
});

describe('deletePlaceReview', () => {
  it('deletes by id and throws on error', async () => {
    const eqOk = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ delete: vi.fn(() => ({ eq: eqOk })) });
    await deletePlaceReview('r1');
    expect(eqOk).toHaveBeenCalledWith('id', 'r1');

    from.mockReturnValue({ delete: () => ({ eq: vi.fn().mockResolvedValue({ error: new Error('x') }) }) });
    await expect(deletePlaceReview('r1')).rejects.toThrow('x');
  });
});
