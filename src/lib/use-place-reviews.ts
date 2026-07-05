import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { StoredPlaceReview } from './types';

interface DbReview {
  id: string;
  place_id: string;
  author_id: string;
  rating: number;
  body: string;
  created_at: string;
}

function toReview(row: DbReview): StoredPlaceReview {
  return {
    id: row.id,
    placeId: row.place_id,
    authorId: row.author_id,
    rating: row.rating,
    text: row.body,
    createdAt: row.created_at,
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
    .select('id, place_id, author_id, rating, body, created_at')
    .eq('place_id', placeId)
    .eq('author_id', user.id)
    .order('created_at');
  if (error) throw error;
  return (data as DbReview[]).map(toReview);
}

export async function addPlaceReview(placeId: string, rating: number, text: string): Promise<void> {
  const body = text.trim();
  if (!placeId || rating < 1 || !body) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('place_reviews')
    .insert({ place_id: placeId, author_id: user.id, rating, body });
  if (error) throw error;
}

export async function updatePlaceReview(id: string, rating: number, text: string): Promise<void> {
  const body = text.trim();
  if (rating < 1 || !body) return;
  const { error } = await supabase.from('place_reviews').update({ rating, body }).eq('id', id);
  if (error) throw error;
}

export async function deletePlaceReview(id: string): Promise<void> {
  const { error } = await supabase.from('place_reviews').delete().eq('id', id);
  if (error) throw error;
}

export function useMyPlaceReviews(placeId: string | undefined) {
  return useQuery({
    queryKey: ['place-reviews', placeId],
    queryFn: () => fetchMyPlaceReviews(placeId as string),
    enabled: !!placeId,
  });
}

export function useAddPlaceReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ placeId, rating, text }: { placeId: string; rating: number; text: string }) =>
      addPlaceReview(placeId, rating, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['place-reviews'] }),
  });
}

export function useUpdatePlaceReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rating, text }: { id: string; rating: number; text: string }) =>
      updatePlaceReview(id, rating, text),
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
