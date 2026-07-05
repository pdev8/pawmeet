import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CommunityReview } from './reviews';
import { supabase } from './supabase';
import type { StoredPlaceReview } from './types';

interface DbReview {
  id: string;
  place_id: string;
  author_id: string;
  rating: number;
  body: string;
  created_at: string;
  photo_url: string | null;
}

function toReview(row: DbReview): StoredPlaceReview {
  return {
    id: row.id,
    placeId: row.place_id,
    authorId: row.author_id,
    rating: row.rating,
    text: row.body,
    createdAt: row.created_at,
    photoUrl: row.photo_url ?? null,
  };
}

/** The signed-in user's reviews for a place (oldest first, to match the mock). */
export async function fetchMyPlaceReviews(placeId: string): Promise<StoredPlaceReview[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !placeId) return [];
  const { data, error } = await supabase
    .from('place_reviews')
    .select('id, place_id, author_id, rating, body, created_at, photo_url')
    .eq('place_id', placeId)
    .eq('author_id', user.id)
    .order('created_at');
  if (error) throw error;
  return (data as DbReview[]).map(toReview);
}

interface DbCommunityReview {
  id: string;
  author_id: string;
  rating: number;
  body: string;
  created_at: string;
  photo_url: string | null;
  author: { display_name: string; avatar_url: string | null } | null;
}

/** Everyone's reviews for a place (author profile embedded), for the community list. */
export async function fetchPlaceReviews(placeId: string): Promise<CommunityReview[]> {
  if (!placeId) return [];
  const { data, error } = await supabase
    .from('place_reviews')
    .select('id, author_id, rating, body, created_at, photo_url, author:profiles(display_name, avatar_url)')
    .eq('place_id', placeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as DbCommunityReview[]).map((r) => ({
    id: r.id,
    authorId: r.author_id,
    authorName: r.author?.display_name ?? 'Someone',
    authorAvatar: r.author?.avatar_url ?? null,
    rating: r.rating,
    text: r.body,
    createdAt: r.created_at,
    photoUrl: r.photo_url ?? null,
  }));
}

export async function addPlaceReview(
  placeId: string,
  rating: number,
  text: string,
  photoUrl?: string | null,
): Promise<void> {
  const body = text.trim();
  if (!placeId || rating < 1 || !body) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('place_reviews')
    .insert({ place_id: placeId, author_id: user.id, rating, body, photo_url: photoUrl ?? null });
  if (error) throw error;
}

export async function updatePlaceReview(
  id: string,
  rating: number,
  text: string,
  photoUrl?: string | null,
): Promise<void> {
  const body = text.trim();
  if (rating < 1 || !body) return;
  const { error } = await supabase
    .from('place_reviews')
    .update({ rating, body, photo_url: photoUrl ?? null })
    .eq('id', id);
  if (error) throw error;
}

export async function deletePlaceReview(id: string): Promise<void> {
  const { error } = await supabase.from('place_reviews').delete().eq('id', id);
  if (error) throw error;
}

export function useMyPlaceReviews(placeId: string | undefined) {
  return useQuery({
    queryKey: ['place-reviews', 'mine', placeId],
    queryFn: () => fetchMyPlaceReviews(placeId as string),
    enabled: !!placeId,
  });
}

/** All reviews for a place (community view). */
export function usePlaceReviews(placeId: string | undefined) {
  return useQuery({
    queryKey: ['place-reviews', 'all', placeId],
    queryFn: () => fetchPlaceReviews(placeId as string),
    enabled: !!placeId,
  });
}

export function useAddPlaceReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      placeId,
      rating,
      text,
      photoUrl,
    }: {
      placeId: string;
      rating: number;
      text: string;
      photoUrl?: string | null;
    }) => addPlaceReview(placeId, rating, text, photoUrl),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['place-reviews'] }),
  });
}

export function useUpdatePlaceReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      rating,
      text,
      photoUrl,
    }: {
      id: string;
      rating: number;
      text: string;
      photoUrl?: string | null;
    }) => updatePlaceReview(id, rating, text, photoUrl),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['place-reviews'] }),
  });
}

export function useDeletePlaceReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePlaceReview(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['place-reviews'] }),
  });
}
