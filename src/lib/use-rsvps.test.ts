import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));

import { supabase } from './supabase';
import {
  cancelMyRsvp,
  fetchEventRsvps,
  fetchGoingCounts,
  goingCountOf,
  resolveGoingStatus,
  tallyGoing,
  type EventRsvp,
} from './use-rsvps';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const auth = supabase.auth as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = supabase.from as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveGoingStatus', () => {
  it('is going when there is no capacity', () => {
    expect(resolveGoingStatus(99, null)).toBe('going');
    expect(resolveGoingStatus(99, undefined)).toBe('going');
  });
  it('is going while under capacity', () => {
    expect(resolveGoingStatus(3, 6)).toBe('going');
  });
  it('waitlists once capacity is reached', () => {
    expect(resolveGoingStatus(6, 6)).toBe('waitlisted');
    expect(resolveGoingStatus(7, 6)).toBe('waitlisted');
  });
});

describe('goingCountOf', () => {
  it('counts only going RSVPs', () => {
    const rows: EventRsvp[] = [
      { id: '1', userId: 'a', status: 'going' },
      { id: '2', userId: 'b', status: 'interested' },
      { id: '3', userId: 'c', status: 'going' },
      { id: '4', userId: 'd', status: 'waitlisted' },
    ];
    expect(goingCountOf(rows)).toBe(2);
  });
});

describe('fetchEventRsvps', () => {
  it('maps rows (incl. embedded profile) to the app shape', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'r1',
          user_id: 'u1',
          status: 'going',
          profiles: { display_name: 'Sam', avatar_url: 'a.png' },
        },
      ],
      error: null,
    });
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) });
    const out = await fetchEventRsvps('e1');
    expect(from).toHaveBeenCalledWith('rsvps');
    expect(eq).toHaveBeenCalledWith('event_id', 'e1');
    expect(out).toEqual([
      { id: 'r1', userId: 'u1', status: 'going', name: 'Sam', avatar: 'a.png' },
    ]);
  });

  it('tolerates a missing profile', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ id: 'r1', user_id: 'u1', status: 'interested', profiles: null }],
      error: null,
    });
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) });
    const [r] = await fetchEventRsvps('e1');
    expect(r.name).toBeUndefined();
    expect(r.avatar).toBeNull();
  });
});

describe('tallyGoing', () => {
  it('counts going RSVPs per event, ignoring other statuses', () => {
    expect(
      tallyGoing([
        { event_id: 'a', status: 'going' },
        { event_id: 'a', status: 'going' },
        { event_id: 'a', status: 'interested' },
        { event_id: 'b', status: 'going' },
      ]),
    ).toEqual({ a: 2, b: 1 });
  });
});

describe('fetchGoingCounts', () => {
  it('short-circuits on an empty id list without querying', async () => {
    expect(await fetchGoingCounts([])).toEqual({});
    expect(from).not.toHaveBeenCalled();
  });

  it('queries going RSVPs for the given events and tallies them', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [
        { event_id: 'e1', status: 'going' },
        { event_id: 'e1', status: 'going' },
      ],
      error: null,
    });
    const inFn = vi.fn(() => ({ eq }));
    from.mockReturnValue({ select: vi.fn(() => ({ in: inFn })) });
    const out = await fetchGoingCounts(['e1', 'e2']);
    expect(inFn).toHaveBeenCalledWith('event_id', ['e1', 'e2']);
    expect(eq).toHaveBeenCalledWith('status', 'going');
    expect(out).toEqual({ e1: 2 });
  });
});

describe('cancelMyRsvp', () => {
  it('deletes the current user’s RSVP for the event', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const eqUser = vi.fn().mockResolvedValue({ error: null });
    const eqEvent = vi.fn(() => ({ eq: eqUser }));
    from.mockReturnValue({ delete: vi.fn(() => ({ eq: eqEvent })) });

    await cancelMyRsvp('e1');

    expect(eqEvent).toHaveBeenCalledWith('event_id', 'e1');
    expect(eqUser).toHaveBeenCalledWith('user_id', 'u1');
  });

  it('throws when signed out', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    await expect(cancelMyRsvp('e1')).rejects.toThrow('Not signed in');
  });
});
