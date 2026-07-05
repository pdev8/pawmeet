import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { RsvpStatus } from './types';

export interface EventRsvp {
  id: string;
  userId: string;
  status: RsvpStatus;
}

/** Whether a "going" RSVP fits under capacity, or must go on the waitlist. */
export function resolveGoingStatus(
  goingCount: number,
  capacity: number | null | undefined,
): RsvpStatus {
  if (capacity != null && goingCount >= capacity) return 'waitlisted';
  return 'going';
}

/** Count active going RSVPs from a rows list. */
export function goingCountOf(rsvps: EventRsvp[]): number {
  return rsvps.filter((r) => r.status === 'going').length;
}

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user.id;
}

export async function fetchEventRsvps(eventId: string): Promise<EventRsvp[]> {
  const { data, error } = await supabase
    .from('rsvps')
    .select('id, user_id, status')
    .eq('event_id', eventId);
  if (error) throw error;
  return (data as { id: string; user_id: string; status: RsvpStatus }[]).map((r) => ({
    id: r.id,
    userId: r.user_id,
    status: r.status,
  }));
}

async function upsertMyRsvp(eventId: string, status: RsvpStatus): Promise<void> {
  const uid = await currentUserId();
  const { error } = await supabase
    .from('rsvps')
    .upsert({ event_id: eventId, user_id: uid, status, pet_ids: [] }, { onConflict: 'event_id,user_id' });
  if (error) throw error;
}

export async function cancelMyRsvp(eventId: string): Promise<void> {
  const uid = await currentUserId();
  const { error } = await supabase.from('rsvps').delete().eq('event_id', eventId).eq('user_id', uid);
  if (error) throw error;
}

export function useEventRsvps(eventId: string | undefined) {
  return useQuery({
    queryKey: ['rsvps', eventId],
    queryFn: () => fetchEventRsvps(eventId as string),
    enabled: !!eventId,
  });
}

export function useCurrentUserId() {
  return useQuery({ queryKey: ['uid'], queryFn: currentUserId });
}

/** Mutations for the current user's RSVP on an event; refetch the event's RSVPs on success. */
export function useRsvpActions(eventId: string) {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: ['rsvps', eventId] });
  return {
    go: useMutation({
      mutationFn: (args: { capacity?: number | null; goingCount: number }) =>
        upsertMyRsvp(eventId, resolveGoingStatus(args.goingCount, args.capacity ?? null)),
      onSuccess,
    }),
    interested: useMutation({ mutationFn: () => upsertMyRsvp(eventId, 'interested'), onSuccess }),
    requestJoin: useMutation({ mutationFn: () => upsertMyRsvp(eventId, 'pending_approval'), onSuccess }),
    cancel: useMutation({ mutationFn: () => cancelMyRsvp(eventId), onSuccess }),
  };
}
