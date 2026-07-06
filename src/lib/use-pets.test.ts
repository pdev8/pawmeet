import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));

import { supabase } from './supabase';
import { addPet, fetchMyPets, fetchPetsForOwners, updatePet } from './use-pets';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const auth = supabase.auth as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = supabase.from as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchMyPets', () => {
  it('returns [] when signed out', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    expect(await fetchMyPets()).toEqual([]);
  });

  it('maps DB rows to the app Pet shape for the signed-in user', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'p1',
          owner_id: 'u1',
          name: 'Rex',
          breed: 'Lab',
          photo_url: 'http://x',
          size: 'L',
          temperament_tags: ['friendly', 'goofy'],
        },
      ],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) });

    const pets = await fetchMyPets();

    expect(from).toHaveBeenCalledWith('pets');
    expect(eq).toHaveBeenCalledWith('owner_id', 'u1');
    expect(pets).toEqual([
      {
        id: 'p1',
        ownerId: 'u1',
        name: 'Rex',
        breed: 'Lab',
        photoUrl: 'http://x',
        size: 'L',
        temperament: ['friendly', 'goofy'],
      },
    ]);
  });

  it('throws when the query errors', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const order = vi.fn().mockResolvedValue({ data: null, error: new Error('boom') });
    from.mockReturnValue({ select: () => ({ eq: () => ({ order }) }) });
    await expect(fetchMyPets()).rejects.toThrow('boom');
  });
});

describe('addPet', () => {
  it('throws when signed out', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    await expect(addPet({ name: 'Rex', breed: 'Lab', size: 'M' })).rejects.toThrow('Not signed in');
  });

  it('inserts a pet owned by the signed-in user', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const insert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ insert });

    await addPet({ name: 'Rex', breed: 'Lab', size: 'M' });

    expect(from).toHaveBeenCalledWith('pets');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ owner_id: 'u1', name: 'Rex', breed: 'Lab', size: 'M' }),
    );
  });

  it('throws when the insert errors', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: new Error('nope') }) });
    await expect(addPet({ name: 'Rex', breed: 'Lab', size: 'M' })).rejects.toThrow('nope');
  });
});

describe('updatePet', () => {
  it('updates the pet by id with the given patch', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update });

    await updatePet('p1', { name: 'Max' });

    expect(update).toHaveBeenCalledWith({ name: 'Max' });
    expect(eq).toHaveBeenCalledWith('id', 'p1');
  });

  it('throws when the update errors', async () => {
    const eq = vi.fn().mockResolvedValue({ error: new Error('bad') });
    from.mockReturnValue({ update: () => ({ eq }) });
    await expect(updatePet('p1', { name: 'x' })).rejects.toThrow('bad');
  });
});

describe('fetchPetsForOwners', () => {
  it('returns [] without querying for an empty owner list', async () => {
    expect(await fetchPetsForOwners([])).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('maps pets for the given owners', async () => {
    const inFn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'p1',
          owner_id: 'u1',
          name: 'Biscuit',
          breed: 'Corgi',
          photo_url: 'x.png',
          size: 'S',
          temperament_tags: null,
        },
      ],
      error: null,
    });
    from.mockReturnValue({ select: vi.fn(() => ({ in: inFn })) });
    const out = await fetchPetsForOwners(['u1', 'u2']);
    expect(from).toHaveBeenCalledWith('pets');
    expect(inFn).toHaveBeenCalledWith('owner_id', ['u1', 'u2']);
    expect(out).toEqual([
      { id: 'p1', ownerId: 'u1', name: 'Biscuit', breed: 'Corgi', photoUrl: 'x.png', size: 'S', temperament: [] },
    ]);
  });
});

describe('deletePet', () => {
  it('deletes a pet by id and throws on error', async () => {
    const { deletePet } = await import('./use-pets');
    const eqOk = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ delete: vi.fn(() => ({ eq: eqOk })) });
    await deletePet('p1');
    expect(from).toHaveBeenCalledWith('pets');
    expect(eqOk).toHaveBeenCalledWith('id', 'p1');

    from.mockReturnValue({ delete: () => ({ eq: vi.fn().mockResolvedValue({ error: new Error('no') }) }) });
    await expect(deletePet('p1')).rejects.toThrow('no');
  });
});
