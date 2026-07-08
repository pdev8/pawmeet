import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));

import { supabase } from './supabase';
import { reportContent } from './use-reports';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const auth = supabase.auth as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = supabase.from as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reportContent', () => {
  it('inserts a report scoped to the current user with a trimmed reason', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const insert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ insert });

    await reportContent('comment', 'c1', '  spam  ');

    expect(from).toHaveBeenCalledWith('reports');
    expect(insert).toHaveBeenCalledWith({
      reporter_id: 'u1',
      target_type: 'comment',
      target_id: 'c1',
      reason: 'spam',
    });
  });

  it('stores null when no reason is given', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const insert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ insert });

    await reportContent('event', 'e1');

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ target_type: 'event', target_id: 'e1', reason: null }),
    );
  });

  it('reports a review target', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const insert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ insert });

    await reportContent('review', 'way-123', 'spam');

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ target_type: 'review', target_id: 'way-123', reason: 'spam' }),
    );
  });

  it('throws when signed out', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    await expect(reportContent('user', 'x')).rejects.toThrow('Not signed in');
  });

  it('propagates a database error', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: { message: 'nope' } }) });
    await expect(reportContent('comment', 'c1')).rejects.toBeTruthy();
  });
});
