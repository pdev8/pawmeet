import { useQuery } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { PetSize } from './types';

export interface PublicPet {
  id: string;
  name: string;
  breed: string;
  photoUrl: string;
  size: PetSize;
  temperament: string[];
}

export interface PublicProfile {
  id: string;
  displayName: string;
  avatarUrl: string;
  homeArea: string;
  pets: PublicPet[];
}

interface DbProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  home_area: string | null;
  pets: {
    id: string;
    name: string;
    breed: string;
    photo_url: string | null;
    size: PetSize;
    temperament_tags: string[] | null;
  }[];
}

/** A user's public profile + their pets (both world-readable to authed users). */
export async function fetchUserProfile(id: string): Promise<PublicProfile | null> {
  if (!id) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, display_name, avatar_url, home_area, pets(id, name, breed, photo_url, size, temperament_tags)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as DbProfile;
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? '',
    homeArea: row.home_area ?? '',
    pets: (row.pets ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      breed: p.breed,
      photoUrl: p.photo_url ?? '',
      size: p.size,
      temperament: p.temperament_tags ?? [],
    })),
  };
}

export function useUserProfile(id: string | undefined) {
  return useQuery({
    queryKey: ['user-profile', id],
    queryFn: () => fetchUserProfile(id as string),
    enabled: !!id,
  });
}
