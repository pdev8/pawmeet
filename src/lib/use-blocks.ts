import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user.id;
}

/** All user ids in a block relationship with me, in either direction — the set
 * to hide across events, RSVPs, and comments. */
export async function fetchBlockedIds(): Promise<string[]> {
  const uid = await currentUserId();
  const { data, error } = await supabase.from('blocks').select('blocker_id, blocked_id');
  if (error) throw error;
  return (data as { blocker_id: string; blocked_id: string }[]).map((r) =>
    r.blocker_id === uid ? r.blocked_id : r.blocker_id,
  );
}

export interface BlockedUser {
  id: string;
  name: string;
  avatar: string | null;
}

interface DbBlockedRow {
  blocked_id: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

/** People I have blocked (my outgoing blocks only), for an unblock list. */
export async function fetchBlockedList(): Promise<BlockedUser[]> {
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id, profiles:profiles!blocks_blocked_id_fkey(display_name, avatar_url)')
    .eq('blocker_id', uid);
  if (error) throw error;
  return (data as unknown as DbBlockedRow[]).map((r) => ({
    id: r.blocked_id,
    name: r.profiles?.display_name ?? 'Someone',
    avatar: r.profiles?.avatar_url ?? null,
  }));
}

export async function blockUser(blockedId: string): Promise<void> {
  const uid = await currentUserId();
  if (blockedId === uid) return;
  const { error } = await supabase
    .from('blocks')
    .upsert(
      { blocker_id: uid, blocked_id: blockedId },
      { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function unblockUser(blockedId: string): Promise<void> {
  const uid = await currentUserId();
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', uid)
    .eq('blocked_id', blockedId);
  if (error) throw error;
}

export function useBlockedIds() {
  return useQuery({ queryKey: ['blocks', 'ids'], queryFn: fetchBlockedIds });
}

export function useBlockedList() {
  return useQuery({ queryKey: ['blocks', 'list'], queryFn: fetchBlockedList });
}

/** Block/unblock; refreshes the block sets plus every read path that hides
 * blocked users so their content appears/disappears immediately. */
export function useBlockActions() {
  const qc = useQueryClient();
  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: ['blocks'] });
    qc.invalidateQueries({ queryKey: ['events'] });
    qc.invalidateQueries({ queryKey: ['comments'] });
    qc.invalidateQueries({ queryKey: ['rsvps'] });
  };
  return {
    block: useMutation({ mutationFn: (id: string) => blockUser(id), onSuccess }),
    unblock: useMutation({ mutationFn: (id: string) => unblockUser(id), onSuccess }),
  };
}
