import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));

import { supabase } from './supabase';
import { addComment, deleteComment, editComment, fetchEventComments } from './use-comments';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const auth = supabase.auth as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = supabase.from as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchEventComments', () => {
  it('maps rows (incl. embedded author) to the app shape', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'c1',
          author_id: 'u1',
          body: 'hi',
          parent_id: null,
          created_at: '2026-01-01T00:00:00Z',
          edited_at: null,
          deleted_by: null,
          author: { display_name: 'Sam', avatar_url: 'a.png' },
        },
      ],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) });

    const out = await fetchEventComments('e1');

    expect(from).toHaveBeenCalledWith('comments');
    expect(eq).toHaveBeenCalledWith('event_id', 'e1');
    expect(out).toEqual([
      {
        id: 'c1',
        authorId: 'u1',
        authorName: 'Sam',
        authorAvatar: 'a.png',
        body: 'hi',
        parentId: null,
        createdAt: '2026-01-01T00:00:00Z',
        editedAt: null,
        deletedBy: null,
      },
    ]);
  });

  it('falls back to "Someone" when the author profile is missing', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'c1',
          author_id: 'u1',
          body: 'hi',
          parent_id: null,
          created_at: '2026-01-01T00:00:00Z',
          edited_at: null,
          deleted_by: null,
          author: null,
        },
      ],
      error: null,
    });
    from.mockReturnValue({ select: vi.fn(() => ({ eq: vi.fn(() => ({ order })) })) });

    const [c] = await fetchEventComments('e1');
    expect(c.authorName).toBe('Someone');
    expect(c.authorAvatar).toBeNull();
  });
});

describe('addComment', () => {
  it('inserts a comment scoped to the current user', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const insert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ insert });

    await addComment('e1', '  hello  ', 'parent1');

    expect(insert).toHaveBeenCalledWith({
      event_id: 'e1',
      author_id: 'u1',
      body: 'hello',
      parent_id: 'parent1',
    });
  });

  it('defaults parent_id to null for top-level comments', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const insert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ insert });

    await addComment('e1', 'top');

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ parent_id: null, body: 'top' }),
    );
  });

  it('skips empty bodies without hitting the network', async () => {
    await addComment('e1', '   ');
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
});

describe('editComment', () => {
  it('updates the body and stamps edited_at', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update });

    await editComment('c1', '  new  ');

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'new', edited_at: expect.any(String) }),
    );
    expect(eq).toHaveBeenCalledWith('id', 'c1');
  });

  it('skips empty edits', async () => {
    await editComment('c1', '   ');
    expect(from).not.toHaveBeenCalled();
  });
});

describe('deleteComment', () => {
  it('soft-deletes by setting deleted_by', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update });

    await deleteComment('c1', 'host');

    expect(update).toHaveBeenCalledWith({ deleted_by: 'host' });
    expect(eq).toHaveBeenCalledWith('id', 'c1');
  });
});
