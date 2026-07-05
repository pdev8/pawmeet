import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { advanceByRecurrence, isArchivable } from './dates';
import { DEFAULT_CENTER, DEFAULT_CENTER_LABEL } from './geo';
import { buildSeed, ME_ID } from './seed';
import type {
  AppNotification,
  EventComment,
  EventRecurrence,
  LatLng,
  Pet,
  PetEvent,
  PetSize,
  Rsvp,
  StoredPlaceReview,
  User,
  VenueType,
} from './types';

export interface EventDraft {
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
  rsvpMode: 'open' | 'host_approves';
  recurrence?: EventRecurrence;
  useMyLocation: boolean;
}

interface AppState {
  hasHydrated: boolean;
  seededWithGps: boolean;
  center: LatLng;
  centerLabel: string;
  currentUserId: string;
  users: Record<string, User>;
  pets: Record<string, Pet>;
  events: Record<string, PetEvent>;
  rsvps: Rsvp[];
  comments: EventComment[];
  notifications: AppNotification[];
  placeReviews: Record<string, StoredPlaceReview[]>;
  favorites: string[];
  draft: Partial<EventDraft> | null;

  setHasHydrated: (v: boolean) => void;
  reseed: (center: LatLng, label: string, keepProfile?: boolean) => void;
  adoptGpsCenter: (center: LatLng) => void;
  archiveSweep: () => void;

  rsvp: (eventId: string, status: 'going' | 'interested') => void;
  requestJoin: (eventId: string) => void;
  cancelRsvp: (eventId: string) => void;
  approveRequest: (rsvpId: string) => void;
  declineRequest: (rsvpId: string) => void;

  addComment: (eventId: string, body: string, parentId?: string) => void;
  editComment: (commentId: string, body: string) => void;
  deleteComment: (commentId: string, by: 'author' | 'host') => void;

  createEvent: (input: Omit<EventDraft, 'useMyLocation'> & { lat: number; lng: number }) => string;
  cancelEvent: (eventId: string) => void;
  setDraft: (draft: Partial<EventDraft> | null) => void;

  addPlaceReview: (placeId: string, rating: number, text: string) => void;
  updatePlaceReview: (placeId: string, reviewId: string, rating: number, text: string) => void;
  deletePlaceReview: (placeId: string, reviewId: string) => void;

  toggleFavorite: (eventId: string) => void;

  updateProfile: (displayName: string) => void;
  addPet: (name: string, breed: string, size: PetSize) => void;
  updatePet: (petId: string, patch: Partial<Pick<Pet, 'name' | 'breed' | 'size'>>) => void;
  markAllNotificationsRead: () => void;
}

let idSeq = 0;
function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${++idSeq}`;
}

function pushNotification(
  list: AppNotification[],
  n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>,
): AppNotification[] {
  return [
    { ...n, id: newId('n'), createdAt: new Date().toISOString(), read: false },
    ...list,
  ];
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      seededWithGps: false,
      center: DEFAULT_CENTER,
      centerLabel: DEFAULT_CENTER_LABEL,
      currentUserId: ME_ID,
      users: {},
      pets: {},
      events: {},
      rsvps: [],
      comments: [],
      notifications: [],
      placeReviews: {},
      favorites: [],
      draft: null,

      setHasHydrated: (v) => set({ hasHydrated: v }),

      reseed: (center, label, keepProfile = true) => {
        const s = get();
        const me = s.users[ME_ID];
        const myPets = Object.values(s.pets).filter((p) => p.ownerId === ME_ID);
        const seed = buildSeed(
          center,
          keepProfile && me ? { user: me, pets: myPets } : undefined,
        );
        set({ ...seed, center, centerLabel: label });
      },

      adoptGpsCenter: (center) => {
        const s = get();
        if (s.seededWithGps) {
          set({ center, centerLabel: 'Near you' });
        } else {
          s.reseed(center, 'Near you');
          set({ seededWithGps: true });
        }
      },

      archiveSweep: () => {
        const s = get();
        let changed = false;
        const events = { ...s.events };
        for (const ev of Object.values(events)) {
          if (ev.status === 'archived' || !isArchivable(ev.endsAt)) continue;
          // Active recurring events roll forward to their next future
          // occurrence instead of archiving; a backend would materialize the
          // next instance. Cancelled series still archive.
          if (ev.recurrence && ev.status === 'active') {
            let starts = new Date(ev.startsAt);
            let ends = new Date(ev.endsAt);
            const now = Date.now();
            for (let guard = 0; starts.getTime() <= now && guard < 120; guard++) {
              starts = advanceByRecurrence(starts, ev.recurrence);
              ends = advanceByRecurrence(ends, ev.recurrence);
            }
            events[ev.id] = { ...ev, startsAt: starts.toISOString(), endsAt: ends.toISOString() };
          } else {
            events[ev.id] = { ...ev, status: 'archived', archivedAt: new Date().toISOString() };
          }
          changed = true;
        }
        if (changed) set({ events });
      },

      rsvp: (eventId, status) => {
        const s = get();
        const ev = s.events[eventId];
        if (!ev || ev.status !== 'active') return;
        const myPetIds = Object.values(s.pets)
          .filter((p) => p.ownerId === s.currentUserId)
          .map((p) => p.id);
        let finalStatus: Rsvp['status'] = status;
        if (status === 'going' && ev.capacity != null) {
          const going = s.rsvps.filter(
            (r) => r.eventId === eventId && r.status === 'going' && r.userId !== s.currentUserId,
          ).length;
          if (going >= ev.capacity) finalStatus = 'waitlisted';
        }
        const existing = s.rsvps.find(
          (r) => r.eventId === eventId && r.userId === s.currentUserId,
        );
        if (existing) {
          set({
            rsvps: s.rsvps.map((r) =>
              r.id === existing.id ? { ...r, status: finalStatus, petIds: myPetIds } : r,
            ),
          });
        } else {
          set({
            rsvps: [
              ...s.rsvps,
              {
                id: newId('r'),
                eventId,
                userId: s.currentUserId,
                petIds: myPetIds,
                status: finalStatus,
                createdAt: new Date().toISOString(),
              },
            ],
          });
        }
      },

      requestJoin: (eventId) => {
        const s = get();
        const ev = s.events[eventId];
        if (!ev || ev.status !== 'active') return;
        const myPetIds = Object.values(s.pets)
          .filter((p) => p.ownerId === s.currentUserId)
          .map((p) => p.id);
        const existing = s.rsvps.find(
          (r) => r.eventId === eventId && r.userId === s.currentUserId,
        );
        const rsvpId = existing?.id ?? newId('r');
        if (existing) {
          set({
            rsvps: s.rsvps.map((r) =>
              r.id === rsvpId ? { ...r, status: 'pending_approval' } : r,
            ),
          });
        } else {
          set({
            rsvps: [
              ...s.rsvps,
              {
                id: rsvpId,
                eventId,
                userId: s.currentUserId,
                petIds: myPetIds,
                status: 'pending_approval',
                createdAt: new Date().toISOString(),
              },
            ],
          });
        }
      },

      cancelRsvp: (eventId) => {
        const s = get();
        const mine = s.rsvps.find(
          (r) => r.eventId === eventId && r.userId === s.currentUserId,
        );
        if (!mine) return;
        const wasGoing = mine.status === 'going';
        let rsvps = s.rsvps.map((r) =>
          r.id === mine.id ? { ...r, status: 'cancelled' as const } : r,
        );
        let notifications = s.notifications;
        const ev = s.events[eventId];
        if (wasGoing && ev?.capacity != null) {
          const waitlisted = rsvps
            .filter((r) => r.eventId === eventId && r.status === 'waitlisted')
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          const promoted = waitlisted[0];
          if (promoted) {
            rsvps = rsvps.map((r) =>
              r.id === promoted.id ? { ...r, status: 'going' as const } : r,
            );
            if (promoted.userId === s.currentUserId) {
              notifications = pushNotification(notifications, {
                type: 'waitlist_promoted',
                eventId,
                message: `A spot opened up — you're in for ${ev.title}!`,
              });
            }
          }
        }
        set({ rsvps, notifications });
      },

      approveRequest: (rsvpId) => {
        const s = get();
        set({
          rsvps: s.rsvps.map((r) =>
            r.id === rsvpId && r.status === 'pending_approval'
              ? { ...r, status: 'going' }
              : r,
          ),
        });
      },

      declineRequest: (rsvpId) => {
        const s = get();
        set({
          rsvps: s.rsvps.map((r) =>
            r.id === rsvpId && r.status === 'pending_approval'
              ? { ...r, status: 'declined_by_host' }
              : r,
          ),
        });
      },

      addComment: (eventId, body, parentId) => {
        const s = get();
        const ev = s.events[eventId];
        if (!ev) return;
        const comment: EventComment = {
          id: newId('c'),
          eventId,
          authorId: s.currentUserId,
          body,
          parentId,
          createdAt: new Date().toISOString(),
        };
        set({ comments: [...s.comments, comment] });
      },

      editComment: (commentId, body) => {
        const s = get();
        set({
          comments: s.comments.map((c) =>
            c.id === commentId
              ? { ...c, body, editedAt: new Date().toISOString() }
              : c,
          ),
        });
      },

      deleteComment: (commentId, by) => {
        const s = get();
        set({
          comments: s.comments.map((c) =>
            c.id === commentId ? { ...c, deletedBy: by } : c,
          ),
        });
      },

      createEvent: (input) => {
        const s = get();
        const id = newId('e');
        const ev: PetEvent = {
          id,
          hostId: s.currentUserId,
          title: input.title,
          description: input.description,
          coverPhotoUrl: input.coverPhotoUrl,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          venueType: input.venueType,
          lat: input.lat,
          lng: input.lng,
          address: input.address,
          areaLabel: input.areaLabel,
          breedFocus: input.breedFocus,
          capacity: input.capacity,
          rsvpMode: input.rsvpMode,
          recurrence: input.recurrence,
          status: 'active',
        };
        const myPetIds = Object.values(s.pets)
          .filter((p) => p.ownerId === s.currentUserId)
          .map((p) => p.id);
        set({
          events: { ...s.events, [id]: ev },
          rsvps: [
            ...s.rsvps,
            {
              id: newId('r'),
              eventId: id,
              userId: s.currentUserId,
              petIds: myPetIds,
              status: 'going',
              createdAt: new Date().toISOString(),
            },
          ],
        });
        return id;
      },

      cancelEvent: (eventId) => {
        const s = get();
        const ev = s.events[eventId];
        if (!ev) return;
        set({
          events: { ...s.events, [eventId]: { ...ev, status: 'cancelled' } },
        });
      },

      setDraft: (draft) => set({ draft }),

      addPlaceReview: (placeId, rating, text) => {
        const body = text.trim();
        if (!placeId || rating < 1 || !body) return;
        const s = get();
        const existing = s.placeReviews[placeId] ?? [];
        const review: StoredPlaceReview = {
          id: newId('pr'),
          placeId,
          authorId: s.currentUserId,
          rating,
          text: body,
          createdAt: new Date().toISOString(),
        };
        set({
          placeReviews: { ...s.placeReviews, [placeId]: [...existing, review] },
        });
      },

      updatePlaceReview: (placeId, reviewId, rating, text) => {
        const body = text.trim();
        if (rating < 1 || !body) return;
        const s = get();
        const list = s.placeReviews[placeId];
        if (!list) return;
        set({
          placeReviews: {
            ...s.placeReviews,
            [placeId]: list.map((r) =>
              r.id === reviewId && r.authorId === s.currentUserId
                ? { ...r, rating, text: body, createdAt: new Date().toISOString() }
                : r,
            ),
          },
        });
      },

      deletePlaceReview: (placeId, reviewId) => {
        const s = get();
        const list = s.placeReviews[placeId];
        if (!list) return;
        // Only the author can delete, and reviews here are always the user's own.
        const next = list.filter(
          (r) => !(r.id === reviewId && r.authorId === s.currentUserId),
        );
        if (next.length === list.length) return;
        const placeReviews = { ...s.placeReviews };
        if (next.length) placeReviews[placeId] = next;
        else delete placeReviews[placeId];
        set({ placeReviews });
      },

      toggleFavorite: (eventId) => {
        const s = get();
        const has = s.favorites.includes(eventId);
        set({
          favorites: has
            ? s.favorites.filter((id) => id !== eventId)
            : [eventId, ...s.favorites],
        });
      },

      updateProfile: (displayName) => {
        const s = get();
        const me = s.users[s.currentUserId];
        if (!me) return;
        set({ users: { ...s.users, [me.id]: { ...me, displayName } } });
      },

      addPet: (name, breed, size) => {
        const s = get();
        const id = newId('p');
        const photoId = 60 + (Object.keys(s.pets).length % 40);
        set({
          pets: {
            ...s.pets,
            [id]: {
              id,
              ownerId: s.currentUserId,
              name,
              breed,
              size,
              photoUrl: `https://placedog.net/300/300?id=${photoId}`,
            },
          },
        });
      },

      updatePet: (petId, patch) => {
        const s = get();
        const pet = s.pets[petId];
        if (!pet) return;
        set({ pets: { ...s.pets, [petId]: { ...pet, ...patch } } });
      },

      markAllNotificationsRead: () => {
        const s = get();
        if (s.notifications.every((n) => n.read)) return;
        set({ notifications: s.notifications.map((n) => ({ ...n, read: true })) });
      },
    }),
    {
      name: 'pawmeet-demo-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        seededWithGps: s.seededWithGps,
        center: s.center,
        centerLabel: s.centerLabel,
        currentUserId: s.currentUserId,
        users: s.users,
        pets: s.pets,
        events: s.events,
        rsvps: s.rsvps,
        comments: s.comments,
        notifications: s.notifications,
        placeReviews: s.placeReviews,
        favorites: s.favorites,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

export { ME_ID };
