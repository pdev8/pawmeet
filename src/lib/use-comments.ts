import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';

export interface DisplayComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  parentId: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedBy: 'author' | 'host' | null;
}

interface DbComment {
  id: string;
  author_id: string;
  body: string;
  parent_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_by: 'author' | 'host' | null;
  author: { display_name: string; avatar_url: string | null } | null;
}

function toComment(r: DbComment): DisplayComment {
  return {
    id: r.id,
    authorId: r.author_id,
    authorName: r.author?.display_name ?? 'Someone',
    authorAvatar: r.author?.avatar_url ?? null,
    body: r.body,
    parentId: r.parent_id,
    createdAt: r.created_at,
    editedAt: r.edited_at,
    deletedBy: r.deleted_by,
  };
}

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user.id;
}

export async function fetchEventComments(eventId: string): Promise<DisplayComment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(
      'id, author_id, body, parent_id, created_at, edited_at, deleted_by, author:profiles(display_name, avatar_url)',
    )
    .eq('event_id', eventId)
    .order('created_at');
  if (error) throw error;
  return (data as unknown as DbComment[]).map(toComment);
}

export async function addComment(eventId: string, body: string, parentId?: string): Promise<void> {
  const text = body.trim();
  if (!text) return;
  const uid = await currentUserId();
  const { error } = await supabase
    .from('comments')
    .insert({ event_id: eventId, author_id: uid, body: text, parent_id: parentId ?? null });
  if (error) throw error;
}

export async function editComment(id: string, body: string): Promise<void> {
  const text = body.trim();
  if (!text) return;
  const { error } = await supabase
    .from('comments')
    .update({ body: text, edited_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteComment(id: string, by: 'author' | 'host'): Promise<void> {
  const { error } = await supabase.from('comments').update({ deleted_by: by }).eq('id', id);
  if (error) throw error;
}

export function useEventComments(eventId: string | undefined) {
  return useQuery({
    queryKey: ['comments', eventId],
    queryFn: () => fetchEventComments(eventId as string),
    enabled: !!eventId,
  });
}

export function useCommentActions(eventId: string) {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: ['comments', eventId] });
  return {
    add: useMutation({
      mutationFn: ({ body, parentId }: { body: string; parentId?: string }) =>
        addComment(eventId, body, parentId),
      onSuccess,
    }),
    edit: useMutation({
      mutationFn: ({ id, body }: { id: string; body: string }) => editComment(id, body),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: ({ id, by }: { id: string; by: 'author' | 'host' }) => deleteComment(id, by),
      onSuccess,
    }),
  };
}
