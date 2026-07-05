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
}

type PetInput = { name: string; breed: string; size: PetSize };
type PetPatch = Partial<PetInput>;

function toPet(row: DbPet): Pet {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    breed: row.breed,
    photoUrl: row.photo_url ?? '',
    size: row.size,
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
    .select('id, owner_id, name, breed, photo_url, size')
    .eq('owner_id', user.id)
    .order('created_at');
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
    // Placeholder pet photo until real uploads land (see BACKLOG Epic 5).
    photo_url: `https://placedog.net/300/300?id=${60 + Math.floor(Math.random() * 40)}`,
  });
  if (error) throw error;
}

export async function updatePet(id: string, patch: PetPatch): Promise<void> {
  const { error } = await supabase.from('pets').update(patch).eq('id', id);
  if (error) throw error;
}

export function useMyPets() {
  return useQuery({ queryKey: ['pets'], queryFn: fetchMyPets });
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
