import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { rankDiscoverEvents, type DiscoveryItem, type Filters } from './filters';
import { fetchBlockedIds } from './use-blocks';
import { fetchGoingAttendees } from './use-rsvps';
import { supabase } from './supabase';
import type {
  EventRecurrence,
  LatLng,
  PetEvent,
  RsvpMode,
  VenueType,
} from './types';

interface DbEvent {
  id: string;
  host_id: string;
  title: string;
  description: string;
  cover_photo_url: string | null;
  starts_at: string;
  ends_at: string;
  venue_type: VenueType;
  lat: number;
  lng: number;
  address: string;
  area_label: string;
  breed_focus: string | null;
  capacity: number | null;
  rsvp_mode: RsvpMode;
  recurrence: EventRecurrence | null;
  status: PetEvent['status'];
  archived_at: string | null;
}

const EVENT_COLUMNS =
  'id, host_id, title, description, cover_photo_url, starts_at, ends_at, venue_type, lat, lng, address, area_label, breed_focus, capacity, rsvp_mode, recurrence, status, archived_at';

export function toEvent(r: DbEvent): PetEvent {
  return {
    id: r.id,
    hostId: r.host_id,
    title: r.title,
    description: r.description,
    coverPhotoUrl: r.cover_photo_url ?? '',
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    venueType: r.venue_type,
    lat: r.lat,
    lng: r.lng,
    address: r.address,
    areaLabel: r.area_label,
    breedFocus: r.breed_focus ?? undefined,
    capacity: r.capacity ?? undefined,
    rsvpMode: r.rsvp_mode,
    recurrence: r.recurrence ?? undefined,
    status: r.status,
    archivedAt: r.archived_at ?? undefined,
  };
}

export type NewEvent = {
  title: string;
  description: string;
  coverPhotoUrl: string;
  startsAt: string;
  endsAt: string;
  venueType: VenueType;
  address: string;
  areaLabel: string;
  breedFocus?: string;
  capacity?: number;
  rsvpMode: RsvpMode;
  recurrence?: EventRecurrence;
  lat: number;
  lng: number;
};

const MILES_TO_METERS = 1609.34;

/**
 * Discover events near a center. The `nearby_events` RPC does the heavy lifting
 * server-side (PostGIS `ST_DWithin` radius + active/public/future filter); the
 * client `rankDiscoverEvents` then applies the date window, breed/venue filters,
 * "has spots", sort, and per-event distance for display.
 */
export async function fetchDiscoverEvents(center: LatLng, filters: Filters): Promise<DiscoveryItem[]> {
  const { data, error } = await supabase.rpc('nearby_events', {
    p_lat: center.lat,
    p_lng: center.lng,
    p_radius_m: filters.radiusMi * MILES_TO_METERS,
  });
  if (error) throw error;
  const blocked = new Set(await fetchBlockedIds());
  const events = (data as DbEvent[]).map(toEvent).filter((e) => !blocked.has(e.hostId));
  const attendees = await fetchGoingAttendees(events.map((e) => e.id));
  const goingCounts: Record<string, number> = {};
  for (const [id, list] of Object.entries(attendees)) goingCounts[id] = list.length;
  return rankDiscoverEvents(events, center, filters, goingCounts).map((item) => ({
    ...item,
    badges: (attendees[item.event.id] ?? []).slice(0, 3).map((a) => ({
      user: { id: a.userId, displayName: a.name, avatarUrl: a.avatar ?? '', homeArea: '' },
      pet: a.petPhoto
        ? { id: '', ownerId: a.userId, name: a.petName ?? '', breed: '', photoUrl: a.petPhoto, size: 'M' as const }
        : undefined,
    })),
  }));
}

export async function fetchEventById(id: string): Promise<PetEvent | null> {
  const { data, error } = await supabase.from('events').select(EVENT_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toEvent(data as DbEvent) : null;
}

export async function createEvent(input: NewEvent): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('events')
    .insert({
      host_id: user.id,
      title: input.title,
      description: input.description,
      cover_photo_url: input.coverPhotoUrl,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      venue_type: input.venueType,
      lat: input.lat,
      lng: input.lng,
      address: input.address,
      area_label: input.areaLabel,
      breed_focus: input.breedFocus ?? null,
      capacity: input.capacity ?? null,
      rsvp_mode: input.rsvpMode,
      recurrence: input.recurrence ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export type EventPatch = Partial<NewEvent>;

/** Update a host's own event (RLS enforces host-only). Only maps provided keys. */
export async function updateEvent(id: string, patch: EventPatch): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.coverPhotoUrl !== undefined) row.cover_photo_url = patch.coverPhotoUrl;
  if (patch.startsAt !== undefined) row.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) row.ends_at = patch.endsAt;
  if (patch.venueType !== undefined) row.venue_type = patch.venueType;
  if (patch.address !== undefined) row.address = patch.address;
  if (patch.areaLabel !== undefined) row.area_label = patch.areaLabel;
  if (patch.breedFocus !== undefined) row.breed_focus = patch.breedFocus ?? null;
  if (patch.capacity !== undefined) row.capacity = patch.capacity ?? null;
  if (patch.rsvpMode !== undefined) row.rsvp_mode = patch.rsvpMode;
  if (patch.recurrence !== undefined) row.recurrence = patch.recurrence ?? null;
  if (patch.lat !== undefined) row.lat = patch.lat;
  if (patch.lng !== undefined) row.lng = patch.lng;
  const { error } = await supabase.from('events').update(row).eq('id', id);
  if (error) throw error;
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EventPatch }) => updateEvent(id, patch),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event', id] });
    },
  });
}

export function useDiscoverEvents(center: LatLng, filters: Filters) {
  return useQuery({
    queryKey: ['events', 'discover', center, filters],
    queryFn: () => fetchDiscoverEvents(center, filters),
  });
}

/** A single event from Supabase (null if not found — caller may fall back to mock). */
export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: () => fetchEventById(id as string),
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}
