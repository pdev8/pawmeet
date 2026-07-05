import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));

import { supabase } from './supabase';
import { blockUser, fetchBlockedIds, fetchBlockedList, unblockUser } from './use-blocks';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const auth = supabase.auth as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = supabase.from as any;

beforeEach(() => {
  vi.clearAllMocks();
  auth.getUser.mockResolvedValue({ data: { user: { id: 'me' } } });
});

describe('fetchBlockedIds', () => {
  it('returns the other party from blocks in either direction', async () => {
    const select = vi.fn().mockResolvedValue({
      data: [
        { blocker_id: 'me', blocked_id: 'a' }, // I blocked a
        { blocker_id: 'b', blocked_id: 'me' }, // b blocked me
      ],
      error: null,
    });
    from.mockReturnValue({ select });
    const ids = await fetchBlockedIds();
    expect(ids.sort()).toEqual(['a', 'b']);
  });

  it('throws when signed out', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    await expect(fetchBlockedIds()).rejects.toThrow('Not signed in');
  });
});

describe('fetchBlockedList', () => {
  it('maps my outgoing blocks with the blocked profile', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ blocked_id: 'a', profiles: { display_name: 'Ann', avatar_url: 'x.png' } }],
      error: null,
    });
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) });
    const list = await fetchBlockedList();
    expect(eq).toHaveBeenCalledWith('blocker_id', 'me');
    expect(list).toEqual([{ id: 'a', name: 'Ann', avatar: 'x.png' }]);
  });
});

describe('blockUser', () => {
  it('upserts a block scoped to me, ignoring duplicates', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ upsert });
    await blockUser('a');
    expect(upsert).toHaveBeenCalledWith(
      { blocker_id: 'me', blocked_id: 'a' },
      { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
    );
  });

  it('is a no-op when trying to block yourself', async () => {
    await blockUser('me');
    expect(from).not.toHaveBeenCalled();
  });
});

describe('unblockUser', () => {
  it('deletes my block of that user', async () => {
    const eqBlocked = vi.fn().mockResolvedValue({ error: null });
    const eqBlocker = vi.fn(() => ({ eq: eqBlocked }));
    from.mockReturnValue({ delete: vi.fn(() => ({ eq: eqBlocker })) });
    await unblockUser('a');
    expect(eqBlocker).toHaveBeenCalledWith('blocker_id', 'me');
    expect(eqBlocked).toHaveBeenCalledWith('blocked_id', 'a');
  });
});
