import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn(), rpc: vi.fn() },
}));

import { DEFAULT_FILTERS } from './filters';
import { supabase } from './supabase';
import { createEvent, fetchDiscoverEvents, fetchEventById, toEvent } from './use-events';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const auth = supabase.auth as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = supabase.from as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc as any;

beforeEach(() => {
  vi.clearAllMocks();
});

const dbRow = {
  id: 'e1',
  host_id: 'u1',
  title: 'Pack Walk',
  description: 'desc',
  cover_photo_url: 'http://c',
  starts_at: '2027-01-01T10:00:00Z',
  ends_at: '2027-01-01T12:00:00Z',
  venue_type: 'public_park',
  lat: 30,
  lng: -97,
  address: '1 St',
  area_label: 'Downtown',
  breed_focus: null,
  capacity: 10,
  rsvp_mode: 'open',
  recurrence: null,
  status: 'active',
  archived_at: null,
};

describe('toEvent', () => {
  it('maps a DB row to the app PetEvent shape', () => {
    expect(toEvent(dbRow as never)).toMatchObject({
      id: 'e1',
      hostId: 'u1',
      coverPhotoUrl: 'http://c',
      startsAt: '2027-01-01T10:00:00Z',
      venueType: 'public_park',
      lat: 30,
      lng: -97,
      areaLabel: 'Downtown',
      capacity: 10,
      breedFocus: undefined,
    });
  });
});

describe('createEvent', () => {
  const input = {
    title: 'T',
    description: 'd',
    coverPhotoUrl: 'c',
    startsAt: 's',
    endsAt: 'e',
    venueType: 'public_park' as const,
    address: 'a',
    areaLabel: 'al',
    rsvpMode: 'open' as const,
    lat: 1,
    lng: 2,
  };

  it('throws when signed out', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    await expect(createEvent(input)).rejects.toThrow('Not signed in');
  });

  it('inserts host-scoped event with lat/lng and returns the new id', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const single = vi.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    from.mockReturnValue({ insert });

    const id = await createEvent(input);

    expect(from).toHaveBeenCalledWith('events');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ host_id: 'u1', title: 'T', lat: 1, lng: 2, venue_type: 'public_park' }),
    );
    expect(id).toBe('new-id');
  });
});

describe('fetchDiscoverEvents', () => {
  it('calls the nearby_events RPC with the radius in meters and ranks the rows', async () => {
    const future = new Date(Date.now() + 3 * 86400000).toISOString();
    rpc.mockResolvedValue({ data: [{ ...dbRow, starts_at: future, ends_at: future }], error: null });
    auth.getUser.mockResolvedValue({ data: { user: { id: 'me' } } });
    from.mockImplementation((table: string) => {
      // fetchBlockedIds → from('blocks').select() resolves to a rows array
      if (table === 'blocks') {
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      }
      // fetchGoingCounts → from('rsvps').select().in().eq()
      return {
        select: () => ({ in: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) }),
      };
    });

    const center = { lat: 30, lng: -97 };
    const items = await fetchDiscoverEvents(center, { ...DEFAULT_FILTERS, radiusMi: 10 });

    expect(rpc).toHaveBeenCalledWith('nearby_events', {
      p_lat: 30,
      p_lng: -97,
      p_radius_m: 10 * 1609.34,
    });
    expect(items.map((i) => i.event.id)).toEqual(['e1']);
    expect(items[0].goingCount).toBe(0);
  });

  it('throws when the RPC errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchDiscoverEvents({ lat: 0, lng: 0 }, DEFAULT_FILTERS)).rejects.toBeTruthy();
  });
});

describe('fetchEventById', () => {
  it('returns null when the event is not found', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle }) }) });
    expect(await fetchEventById('missing')).toBeNull();
  });

  it('maps the row when found', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle }) }) });
    const ev = await fetchEventById('e1');
    expect(ev?.id).toBe('e1');
    expect(ev?.hostId).toBe('u1');
  });
});
