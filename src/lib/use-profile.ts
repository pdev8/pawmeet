import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  home_area: string | null;
}

type ProfilePatch = Partial<Pick<Profile, 'display_name' | 'avatar_url' | 'home_area'>>;

/** Fetch the signed-in user's profile row (null when signed out). */
export async function fetchProfile(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, home_area')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return data as Profile;
}

/** Update the signed-in user's profile row. */
export async function updateProfile(patch: ProfilePatch): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
  if (error) throw error;
}

/** The signed-in user's profile row. */
export function useProfile() {
  return useQuery({ queryKey: ['profile'], queryFn: fetchProfile });
}

/** Update the signed-in user's profile; refreshes the cached profile on success. */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
}
