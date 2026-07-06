import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-calendar', () => ({ createEventInCalendarAsync: vi.fn() }));

import { calendarDraft } from './calendar';
import type { PetEvent } from './types';

const ev = (over: Partial<PetEvent> = {}): PetEvent => ({
  id: 'e1',
  hostId: 'h',
  title: 'Pack Walk',
  description: 'Bring water',
  coverPhotoUrl: '',
  startsAt: '2027-01-01T18:00:00.000Z',
  endsAt: '2027-01-01T20:00:00.000Z',
  venueType: 'public_park',
  lat: 33.68,
  lng: -117.83,
  address: '1 Main St, Irvine, CA',
  areaLabel: 'Irvine, CA',
  rsvpMode: 'open',
  status: 'active',
  ...over,
});

describe('calendarDraft', () => {
  it('maps event fields to the calendar draft', () => {
    const d = calendarDraft(ev());
    expect(d.title).toBe('Pack Walk');
    expect(d.startDate.toISOString()).toBe('2027-01-01T18:00:00.000Z');
    expect(d.endDate.toISOString()).toBe('2027-01-01T20:00:00.000Z');
    expect(d.location).toBe('1 Main St, Irvine, CA');
    expect(d.notes).toBe('Bring water');
  });

  it('falls back to the area label when there is no address', () => {
    expect(calendarDraft(ev({ address: '' })).location).toBe('Irvine, CA');
  });
});
