export type BadgeTint = 'bronze' | 'silver' | 'gold' | 'teal' | 'purple' | 'green' | 'orange' | 'crimson';

export interface AchievementStats {
  attended: number;
  hosted: number;
  going: number;
  pets: number;
  breedFocusHosted: boolean;
}

export interface Achievement {
  id: string;
  label: string;
  /** SF Symbol name for the medal face. */
  sf: string;
  tint: BadgeTint;
  earned: boolean;
  /** How to earn it (shown on locked medals). */
  hint: string;
}

/** Derive the achievement medals + earned state from a user's activity stats. */
export function computeAchievements(s: AchievementStats): Achievement[] {
  return [
    { id: 'first', label: 'First Meetup', sf: 'pawprint.fill', tint: 'bronze', earned: s.attended >= 1, hint: 'Attend your first event' },
    { id: 'regular', label: 'Regular', sf: 'star.fill', tint: 'silver', earned: s.going >= 5, hint: 'RSVP to 5 events' },
    { id: 'pack-leader', label: 'Pack Leader', sf: 'star.circle.fill', tint: 'gold', earned: s.going >= 15, hint: 'RSVP to 15 events' },
    { id: 'host', label: 'Host', sf: 'house.fill', tint: 'teal', earned: s.hosted >= 1, hint: 'Host an event' },
    { id: 'super-host', label: 'Super Host', sf: 'crown.fill', tint: 'crimson', earned: s.hosted >= 5, hint: 'Host 5 events' },
    { id: 'ambassador', label: 'Breed Ambassador', sf: 'rosette', tint: 'purple', earned: s.breedFocusHosted, hint: 'Host a breed-focused event' },
    { id: 'pet-parent', label: 'Pet Parent', sf: 'pawprint.circle.fill', tint: 'green', earned: s.pets >= 1, hint: 'Add a pet to your profile' },
    { id: 'full-house', label: 'Full House', sf: 'heart.circle.fill', tint: 'orange', earned: s.pets >= 3, hint: 'Add 3 pets' },
  ];
}
