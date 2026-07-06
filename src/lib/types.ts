export type VenueType = 'home_backyard' | 'public_park' | 'dog_park' | 'business' | 'other';
export type EventStatus = 'active' | 'cancelled' | 'archived';
export type RsvpStatus =
  | 'going'
  | 'interested'
  | 'pending_approval'
  | 'waitlisted'
  | 'declined_by_host'
  | 'cancelled';
export type RsvpMode = 'open' | 'host_approves';
export type PetSize = 'XS' | 'S' | 'M' | 'L' | 'XL';

export const PET_SIZES: PetSize[] = ['XS', 'S', 'M', 'L', 'XL'];

export const SIZE_LABELS: Record<PetSize, string> = {
  XS: 'Petite',
  S: 'Small',
  M: 'Medium',
  L: 'Large',
  XL: 'X-Large',
};
export type EventRecurrence = 'weekly' | 'biweekly' | 'monthly';

export interface LatLng {
  lat: number;
  lng: number;
}

/** A review the current user wrote for a map place, keyed by DogPlace id. */
export interface StoredPlaceReview {
  id: string;
  placeId: string;
  authorId: string;
  rating: number;
  text: string;
  createdAt: string;
  photoUrl?: string | null;
}

export interface User {
  id: string;
  displayName: string;
  avatarUrl: string;
  homeArea: string;
}

export interface Pet {
  id: string;
  ownerId: string;
  name: string;
  breed: string;
  photoUrl: string;
  size: PetSize;
  temperament?: string[];
}

export interface PetEvent {
  id: string;
  hostId: string;
  title: string;
  description: string;
  coverPhotoUrl: string;
  startsAt: string;
  endsAt: string;
  venueType: VenueType;
  lat: number;
  lng: number;
  /** Full street address — only revealed per privacy rules for backyard events. */
  address: string;
  /** Neighborhood-level label, always safe to show. */
  areaLabel: string;
  breedFocus?: string;
  capacity?: number;
  rsvpMode: RsvpMode;
  /** When set, the event repeats; it rolls forward to its next occurrence
   *  instead of archiving once it's over (see store.archiveSweep). */
  recurrence?: EventRecurrence;
  status: EventStatus;
  archivedAt?: string;
}

export interface Rsvp {
  id: string;
  eventId: string;
  userId: string;
  petIds: string[];
  status: RsvpStatus;
  createdAt: string;
}

export interface EventComment {
  id: string;
  eventId: string;
  authorId: string;
  body: string;
  parentId?: string;
  createdAt: string;
  editedAt?: string;
  deletedBy?: 'author' | 'host';
}

export type NotificationType =
  | 'request_received'
  | 'rsvp_approved'
  | 'request_declined'
  | 'comment'
  | 'reply'
  | 'waitlist_promoted'
  | 'event_cancelled'
  | 'event_updated';

export interface AppNotification {
  id: string;
  type: NotificationType;
  eventId?: string;
  fromUserId?: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export const VENUE_LABELS: Record<VenueType, string> = {
  home_backyard: 'Backyard',
  public_park: 'Park',
  dog_park: 'Dog park',
  business: 'Business',
  other: 'Other',
};

export const RECURRENCE_LABELS: Record<EventRecurrence, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
};

export const VENUE_ICONS: Record<VenueType, string> = {
  home_backyard: 'house.fill',
  public_park: 'tree.fill',
  dog_park: 'pawprint.fill',
  business: 'building.2.fill',
  other: 'mappin',
};
