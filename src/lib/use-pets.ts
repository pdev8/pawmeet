import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { Pet, PetSize } from './types';

interface DbPet {
  id: string;
  owner_id: string;
  name: string;
  breed: string;
  photo_url: string | null;
  size: PetSize;
  temperament_tags: string[] | null;
}

type PetInput = { name: string; breed: string; size: PetSize; photoUrl?: string; temperament?: string[] };
type PetPatch = Partial<PetInput>;

function toPet(row: DbPet): Pet {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    breed: row.breed,
    photoUrl: row.photo_url ?? '',
    size: row.size,
    temperament: row.temperament_tags ?? [],
  };
}

/** The signed-in user's pets (mapped to the app Pet shape). */
export async function fetchMyPets(): Promise<Pet[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('pets')
    .select('id, owner_id, name, breed, photo_url, size, temperament_tags')
    .eq('owner_id', user.id)
    .order('created_at');
  if (error) throw error;
  return (data as DbPet[]).map(toPet);
}

/** Pets for a set of owners (world-readable) — for host dashboards / attendee lists. */
export async function fetchPetsForOwners(ownerIds: string[]): Promise<Pet[]> {
  if (ownerIds.length === 0) return [];
  const { data, error } = await supabase
    .from('pets')
    .select('id, owner_id, name, breed, photo_url, size, temperament_tags')
    .in('owner_id', ownerIds);
  if (error) throw error;
  return (data as DbPet[]).map(toPet);
}

export async function addPet(input: PetInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase.from('pets').insert({
    owner_id: user.id,
    name: input.name,
    breed: input.breed,
    size: input.size,
    temperament_tags: input.temperament ?? [],
    // A picked-and-uploaded photo, else a placeholder from placedog.net.
    photo_url:
      input.photoUrl ?? `https://placedog.net/300/300?id=${60 + Math.floor(Math.random() * 40)}`,
  });
  if (error) throw error;
}

export async function updatePet(id: string, patch: PetPatch): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.breed !== undefined) row.breed = patch.breed;
  if (patch.size !== undefined) row.size = patch.size;
  if (patch.photoUrl !== undefined) row.photo_url = patch.photoUrl;
  if (patch.temperament !== undefined) row.temperament_tags = patch.temperament;
  const { error } = await supabase.from('pets').update(row).eq('id', id);
  if (error) throw error;
}

export async function deletePet(id: string): Promise<void> {
  const { error } = await supabase.from('pets').delete().eq('id', id);
  if (error) throw error;
}

export function useMyPets() {
  return useQuery({ queryKey: ['pets'], queryFn: fetchMyPets });
}

export function useDeletePet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePet(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pets'] }),
  });
}

export function usePetsForOwners(ownerIds: string[]) {
  const key = [...ownerIds].sort();
  return useQuery({
    queryKey: ['pets', 'owners', key],
    queryFn: () => fetchPetsForOwners(ownerIds),
    enabled: ownerIds.length > 0,
  });
}

export function useAddPet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addPet,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pets'] }),
  });
}

export function useUpdatePet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PetPatch }) => updatePet(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pets'] }),
  });
}
