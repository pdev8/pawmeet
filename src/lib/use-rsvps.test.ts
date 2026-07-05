import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));

import { supabase } from './supabase';
import {
  cancelMyRsvp,
  fetchEventRsvps,
  goingCountOf,
  resolveGoingStatus,
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
  it('maps rows to the app shape', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ id: 'r1', user_id: 'u1', status: 'going' }],
      error: null,
    });
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) });
    const out = await fetchEventRsvps('e1');
    expect(from).toHaveBeenCalledWith('rsvps');
    expect(eq).toHaveBeenCalledWith('event_id', 'e1');
    expect(out).toEqual([{ id: 'r1', userId: 'u1', status: 'going' }]);
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
