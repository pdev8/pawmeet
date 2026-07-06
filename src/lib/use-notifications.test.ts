import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));

import { supabase } from './supabase';
import { fetchMyNotifications, markNotificationsRead, notifyEventAttendees } from './use-notifications';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const auth = supabase.auth as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = supabase.from as any;

beforeEach(() => {
  vi.clearAllMocks();
  auth.getUser.mockResolvedValue({ data: { user: { id: 'me' } } });
});

describe('fetchMyNotifications', () => {
  it('maps rows to the app shape, scoped + ordered', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        { id: 'n1', type: 'event_updated', message: 'Updated', event_id: 'e1', read: false, created_at: 't1' },
      ],
      error: null,
    });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) });

    const out = await fetchMyNotifications();
    expect(from).toHaveBeenCalledWith('notifications');
    expect(eq).toHaveBeenCalledWith('user_id', 'me');
    expect(out).toEqual([
      { id: 'n1', type: 'event_updated', message: 'Updated', eventId: 'e1', read: false, createdAt: 't1' },
    ]);
  });
});

describe('markNotificationsRead', () => {
  it('marks the user’s unread notifications read', async () => {
    const eqRead = vi.fn().mockResolvedValue({ error: null });
    const eqUser = vi.fn(() => ({ eq: eqRead }));
    const update = vi.fn(() => ({ eq: eqUser }));
    from.mockReturnValue({ update });

    await markNotificationsRead();

    expect(update).toHaveBeenCalledWith({ read: true });
    expect(eqUser).toHaveBeenCalledWith('user_id', 'me');
    expect(eqRead).toHaveBeenCalledWith('read', false);
  });
});

describe('notifyEventAttendees', () => {
  it('inserts a notification per attendee, excluding the actor', async () => {
    // 1st from(): rsvps select().eq().in()
    const inFn = vi.fn().mockResolvedValue({
      data: [{ user_id: 'me' }, { user_id: 'u2' }, { user_id: 'u3' }],
      error: null,
    });
    const eq = vi.fn(() => ({ in: inFn }));
    // 2nd from(): notifications insert()
    const insert = vi.fn().mockResolvedValue({ error: null });
    from
      .mockReturnValueOnce({ select: vi.fn(() => ({ eq })) })
      .mockReturnValueOnce({ insert });

    await notifyEventAttendees('e1', 'event_updated', 'changed');

    const rows = insert.mock.calls[0][0];
    expect(rows).toHaveLength(2); // me excluded
    expect(rows.every((r: { from_user_id: string }) => r.from_user_id === 'me')).toBe(true);
    expect(rows.map((r: { user_id: string }) => r.user_id).sort()).toEqual(['u2', 'u3']);
  });

  it('is a no-op when the only attendee is the actor', async () => {
    const inFn = vi.fn().mockResolvedValue({ data: [{ user_id: 'me' }], error: null });
    from.mockReturnValueOnce({ select: vi.fn(() => ({ eq: vi.fn(() => ({ in: inFn })) })) });
    await notifyEventAttendees('e1', 'event_updated', 'changed');
    // only one from() call (rsvps); no insert
    expect(from).toHaveBeenCalledTimes(1);
  });
});
