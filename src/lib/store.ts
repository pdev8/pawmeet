import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isArchivable } from './dates';
import { DEFAULT_CENTER, DEFAULT_CENTER_LABEL } from './geo';
import { buildSeed, ME_ID } from './seed';
import type {
  AppNotification,
  EventComment,
  LatLng,
  Pet,
  PetEvent,
  PetSize,
  Rsvp,
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

const CANNED_HOST_REPLIES = [
  'Great question — will post details in the thread tonight! 🐶',
  "Yes! And feel free to bring a friend (human or dog).",
  "Good thinking — I'll pin an update about that tomorrow.",
];

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
          if (ev.status !== 'archived' && isArchivable(ev.endsAt)) {
            events[ev.id] = {
              ...ev,
              status: 'archived',
              archivedAt: new Date().toISOString(),
            };
            changed = true;
          }
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
        // Demo: the mock host approves your request a few seconds later.
        if (ev.hostId !== s.currentUserId) {
          setTimeout(() => {
            const st = get();
            const r = st.rsvps.find((x) => x.id === rsvpId);
            if (!r || r.status !== 'pending_approval') return;
            set({
              rsvps: st.rsvps.map((x) =>
                x.id === rsvpId ? { ...x, status: 'going' } : x,
              ),
              notifications: pushNotification(st.notifications, {
                type: 'rsvp_approved',
                eventId,
                fromUserId: ev.hostId,
                message: `${st.users[ev.hostId]?.displayName ?? 'The host'} approved your request to join ${ev.title} — exact address unlocked`,
              }),
            });
          }, 6000);
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
        // Demo: mock hosts reply to your top-level questions after a few seconds.
        if (!parentId && ev.hostId !== s.currentUserId && ev.status === 'active') {
          const reply = CANNED_HOST_REPLIES[s.comments.length % CANNED_HOST_REPLIES.length];
          setTimeout(() => {
            const st = get();
            st.comments.some((c) => c.id === comment.id) &&
              set({
                comments: [
                  ...st.comments,
                  {
                    id: newId('c'),
                    eventId,
                    authorId: ev.hostId,
                    body: reply,
                    parentId: comment.id,
                    createdAt: new Date().toISOString(),
                  },
                ],
                notifications: pushNotification(st.notifications, {
                  type: 'reply',
                  eventId,
                  fromUserId: ev.hostId,
                  message: `${st.users[ev.hostId]?.displayName ?? 'The host'} replied to your comment on ${ev.title}`,
                }),
              });
          }, 7000);
        }
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
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

export { ME_ID };
