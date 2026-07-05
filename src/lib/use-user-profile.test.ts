import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from './supabase';
import { fetchUserProfile } from './use-user-profile';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = supabase.from as any;

beforeEach(() => {
  vi.clearAllMocks();
});

const mockProfile = (row: unknown) => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  from.mockReturnValue({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) });
};

describe('fetchUserProfile', () => {
  it('returns null without querying for a missing id', async () => {
    expect(await fetchUserProfile('')).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('returns null when the profile is not found', async () => {
    mockProfile(null);
    expect(await fetchUserProfile('missing')).toBeNull();
  });

  it('maps profile + embedded pets to the public shape', async () => {
    mockProfile({
      id: 'u1',
      display_name: 'Sam',
      avatar_url: 'a.png',
      home_area: 'Austin',
      pets: [
        {
          id: 'p1',
          name: 'Biscuit',
          breed: 'Corgi',
          photo_url: 'b.png',
          size: 'M',
          temperament_tags: ['playful', 'shy'],
        },
      ],
    });

    const out = await fetchUserProfile('u1');

    expect(from).toHaveBeenCalledWith('profiles');
    expect(out).toEqual({
      id: 'u1',
      displayName: 'Sam',
      avatarUrl: 'a.png',
      homeArea: 'Austin',
      pets: [
        { id: 'p1', name: 'Biscuit', breed: 'Corgi', photoUrl: 'b.png', size: 'M', temperament: ['playful', 'shy'] },
      ],
    });
  });

  it('tolerates null avatar / home / pets / temperament', async () => {
    mockProfile({
      id: 'u1',
      display_name: 'Sam',
      avatar_url: null,
      home_area: null,
      pets: [{ id: 'p1', name: 'B', breed: 'Mutt', photo_url: null, size: 'S', temperament_tags: null }],
    });
    const out = await fetchUserProfile('u1');
    expect(out?.avatarUrl).toBe('');
    expect(out?.homeArea).toBe('');
    expect(out?.pets[0]).toMatchObject({ photoUrl: '', temperament: [] });
  });
});
