import { distanceMi } from './geo';
import type { LatLng, Pet, PetEvent, Rsvp, User, VenueType } from './types';

interface DataSlice {
  users: Record<string, User>;
  pets: Record<string, Pet>;
  events: Record<string, PetEvent>;
  rsvps: Rsvp[];
  comments: { eventId: string; deletedBy?: 'author' | 'host' }[];
  currentUserId: string;
}

export function eventRsvps(s: DataSlice, eventId: string): Rsvp[] {
  return s.rsvps.filter((r) => r.eventId === eventId);
}

export function goingRsvps(s: DataSlice, eventId: string): Rsvp[] {
  return eventRsvps(s, eventId)
    .filter((r) => r.status === 'going')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function interestedRsvps(s: DataSlice, eventId: string): Rsvp[] {
  return eventRsvps(s, eventId).filter((r) => r.status === 'interested');
}

export function pendingRsvps(s: DataSlice, eventId: string): Rsvp[] {
  return eventRsvps(s, eventId)
    .filter((r) => r.status === 'pending_approval')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function myRsvp(s: DataSlice, eventId: string): Rsvp | undefined {
  const r = s.rsvps.find(
    (x) => x.eventId === eventId && x.userId === s.currentUserId,
  );
  return r && r.status !== 'cancelled' && r.status !== 'declined_by_host' ? r : undefined;
}

export interface AttendeeBadge {
  user: User;
  pet?: Pet;
}

export function attendeeBadges(s: DataSlice, eventId: string, limit = 5): {
  badges: AttendeeBadge[];
  goingCount: number;
} {
  const going = goingRsvps(s, eventId);
  const badges = going.slice(0, limit).flatMap((r) => {
    const user = s.users[r.userId];
    if (!user) return [];
    return [{ user, pet: r.petIds.map((id) => s.pets[id]).find(Boolean) }];
  });
  return { badges, goingCount: going.length };
}

export function spotsLeft(s: DataSlice, ev: PetEvent): number | null {
  if (ev.capacity == null) return null;
  return Math.max(0, ev.capacity - goingRsvps(s, ev.id).length);
}

export function commentCount(s: DataSlice, eventId: string): number {
  return s.comments.filter((c) => c.eventId === eventId && !c.deletedBy).length;
}

export function isHost(s: DataSlice, ev: PetEvent): boolean {
  return ev.hostId === s.currentUserId;
}

/**
 * Address privacy: backyard events only reveal the exact address to the host
 * and approved (going) attendees, and never once archived.
 */
export function visibleAddress(s: DataSlice, ev: PetEvent): {
  text: string;
  isApproximate: boolean;
} {
  if (ev.venueType !== 'home_backyard') return { text: ev.address, isApproximate: false };
  if (ev.status === 'archived') return { text: ev.areaLabel, isApproximate: true };
  if (isHost(s, ev)) return { text: ev.address, isApproximate: false };
  const mine = myRsvp(s, ev.id);
  if (mine?.status === 'going') return { text: ev.address, isApproximate: false };
  return { text: ev.areaLabel, isApproximate: true };
}

export function eventDistanceMi(ev: PetEvent, from: LatLng): number {
  return distanceMi(from, { lat: ev.lat, lng: ev.lng });
}

export function myPets(s: DataSlice): Pet[] {
  return Object.values(s.pets).filter((p) => p.ownerId === s.currentUserId);
}

export function hostedEvents(s: DataSlice, status?: PetEvent['status']): PetEvent[] {
  return Object.values(s.events)
    .filter((e) => e.hostId === s.currentUserId && (!status || e.status === status))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

export function myUpcomingEvents(s: DataSlice): { event: PetEvent; rsvp: Rsvp }[] {
  return s.rsvps
    .filter(
      (r) =>
        r.userId === s.currentUserId &&
        ['going', 'interested', 'pending_approval', 'waitlisted'].includes(r.status),
    )
    .flatMap((r) => {
      const event = s.events[r.eventId];
      return event && event.status === 'active' ? [{ event, rsvp: r }] : [];
    })
    .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
}

export function myPastEvents(s: DataSlice): PetEvent[] {
  const attended = new Set(
    s.rsvps
      .filter((r) => r.userId === s.currentUserId && r.status === 'going')
      .map((r) => r.eventId),
  );
  return Object.values(s.events)
    .filter((e) => e.status === 'archived' && (attended.has(e.id) || e.hostId === s.currentUserId))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

export interface VenueFilterOption {
  value: VenueType;
  label: string;
}
