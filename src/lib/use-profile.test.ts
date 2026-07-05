import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Supabase client (runtime only; avoids the RN polyfill/native imports).
vi.mock('./supabase', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));

import { supabase } from './supabase';
import { fetchProfile, updateProfile } from './use-profile';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const auth = supabase.auth as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = supabase.from as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchProfile', () => {
  it('returns null when signed out', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    expect(await fetchProfile()).toBeNull();
  });

  it('returns the profile row for the signed-in user', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const single = vi.fn().mockResolvedValue({ data: { id: 'u1', display_name: 'Pup' }, error: null });
    const eq = vi.fn(() => ({ single }));
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) });

    const profile = await fetchProfile();

    expect(from).toHaveBeenCalledWith('profiles');
    expect(eq).toHaveBeenCalledWith('id', 'u1');
    expect(profile).toEqual({ id: 'u1', display_name: 'Pup' });
  });

  it('throws when the query errors', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const single = vi.fn().mockResolvedValue({ data: null, error: new Error('boom') });
    from.mockReturnValue({ select: () => ({ eq: () => ({ single }) }) });
    await expect(fetchProfile()).rejects.toThrow('boom');
  });
});

describe('updateProfile', () => {
  it('throws when signed out', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    await expect(updateProfile({ display_name: 'x' })).rejects.toThrow('Not signed in');
  });

  it('updates only the signed-in user’s row with the given patch', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update });

    await updateProfile({ display_name: 'New Name' });

    expect(from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith({ display_name: 'New Name' });
    expect(eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('throws when the update errors', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const eq = vi.fn().mockResolvedValue({ error: new Error('nope') });
    from.mockReturnValue({ update: () => ({ eq }) });
    await expect(updateProfile({ display_name: 'x' })).rejects.toThrow('nope');
  });
});
