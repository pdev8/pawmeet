import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { RsvpStatus } from './types';

export interface EventRsvp {
  id: string;
  userId: string;
  status: RsvpStatus;
  name?: string;
  avatar?: string | null;
  petName?: string;
  petPhoto?: string | null;
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

interface DbProfileWithPet {
  display_name: string;
  avatar_url: string | null;
  pets: { name: string; photo_url: string | null }[] | null;
}
interface DbRsvp {
  id: string;
  user_id: string;
  status: RsvpStatus;
  profiles: DbProfileWithPet | null;
}

export async function fetchEventRsvps(eventId: string): Promise<EventRsvp[]> {
  const { data, error } = await supabase
    .from('rsvps')
    .select('id, user_id, status, profiles(display_name, avatar_url, pets(name, photo_url))')
    .eq('event_id', eventId);
  if (error) throw error;
  return (data as unknown as DbRsvp[]).map((r) => {
    const pet = r.profiles?.pets?.[0];
    return {
      id: r.id,
      userId: r.user_id,
      status: r.status,
      name: r.profiles?.display_name,
      avatar: r.profiles?.avatar_url ?? null,
      petName: pet?.name,
      petPhoto: pet?.photo_url ?? null,
    };
  });
}

/** Tally going RSVPs per event id from a flat rows list. */
export function tallyGoing(rows: { event_id: string; status: RsvpStatus }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    if (r.status === 'going') counts[r.event_id] = (counts[r.event_id] ?? 0) + 1;
  }
  return counts;
}

export interface GoingAttendee {
  userId: string;
  name: string;
  avatar: string | null;
  petName?: string;
  petPhoto?: string | null;
}

interface DbGoingRow {
  event_id: string;
  user_id: string;
  profiles: DbProfileWithPet | null;
}

/** Going attendees (with profile + first pet) grouped by event id, for card badges. */
export async function fetchGoingAttendees(
  eventIds: string[],
): Promise<Record<string, GoingAttendee[]>> {
  if (eventIds.length === 0) return {};
  const { data, error } = await supabase
    .from('rsvps')
    .select('event_id, user_id, profiles(display_name, avatar_url, pets(name, photo_url))')
    .in('event_id', eventIds)
    .eq('status', 'going');
  if (error) throw error;
  const out: Record<string, GoingAttendee[]> = {};
  for (const r of data as unknown as DbGoingRow[]) {
    const pet = r.profiles?.pets?.[0];
    (out[r.event_id] ??= []).push({
      userId: r.user_id,
      name: r.profiles?.display_name ?? 'Someone',
      avatar: r.profiles?.avatar_url ?? null,
      petName: pet?.name,
      petPhoto: pet?.photo_url ?? null,
    });
  }
  return out;
}

/** Going counts keyed by event id, for a batch of events (empty in → empty out). */
export async function fetchGoingCounts(eventIds: string[]): Promise<Record<string, number>> {
  if (eventIds.length === 0) return {};
  const { data, error } = await supabase
    .from('rsvps')
    .select('event_id, status')
    .in('event_id', eventIds)
    .eq('status', 'going');
  if (error) throw error;
  return tallyGoing(data as { event_id: string; status: RsvpStatus }[]);
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

// ---- Host approve/decline of join requests ----

export interface HostJoinRequest {
  rsvpId: string;
  eventId: string;
  eventTitle: string;
  capacity: number | null;
  userId: string;
  name: string;
  avatar: string | null;
}

interface DbJoinRequest {
  id: string;
  event_id: string;
  user_id: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
  events: { title: string; capacity: number | null } | null;
}

/** Pending join requests across the current user's active hosted events. */
export async function fetchHostPendingRequests(): Promise<HostJoinRequest[]> {
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from('rsvps')
    .select(
      'id, event_id, user_id, profiles(display_name, avatar_url), events!inner(title, capacity, host_id, status)',
    )
    .eq('status', 'pending_approval')
    .eq('events.host_id', uid)
    .eq('events.status', 'active');
  if (error) throw error;
  return (data as unknown as DbJoinRequest[]).map((r) => ({
    rsvpId: r.id,
    eventId: r.event_id,
    eventTitle: r.events?.title ?? 'your event',
    capacity: r.events?.capacity ?? null,
    userId: r.user_id,
    name: r.profiles?.display_name ?? 'Someone',
    avatar: r.profiles?.avatar_url ?? null,
  }));
}

/** Approve a request → going, or waitlisted if the event is already at capacity. */
export async function approveRsvp(
  rsvpId: string,
  eventId: string,
  capacity: number | null,
): Promise<void> {
  const counts = await fetchGoingCounts([eventId]);
  const status = resolveGoingStatus(counts[eventId] ?? 0, capacity);
  const { error } = await supabase.from('rsvps').update({ status }).eq('id', rsvpId);
  if (error) throw error;
}

export async function declineRsvp(rsvpId: string): Promise<void> {
  const { error } = await supabase
    .from('rsvps')
    .update({ status: 'declined_by_host' })
    .eq('id', rsvpId);
  if (error) throw error;
}

export function useHostPendingRequests() {
  return useQuery({ queryKey: ['host-requests'], queryFn: fetchHostPendingRequests });
}

/** Approve/decline mutations; refresh the request queue + the event's RSVPs. */
export function useHostRequestActions() {
  const qc = useQueryClient();
  const onSuccess = (eventId: string) => {
    qc.invalidateQueries({ queryKey: ['host-requests'] });
    qc.invalidateQueries({ queryKey: ['rsvps', eventId] });
  };
  return {
    approve: useMutation({
      mutationFn: (r: HostJoinRequest) => approveRsvp(r.rsvpId, r.eventId, r.capacity),
      onSuccess: (_data, r) => onSuccess(r.eventId),
    }),
    decline: useMutation({
      mutationFn: (r: HostJoinRequest) => declineRsvp(r.rsvpId),
      onSuccess: (_data, r) => onSuccess(r.eventId),
    }),
  };
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
