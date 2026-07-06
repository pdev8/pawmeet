import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { NotificationType } from './types';

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  eventId: string | null;
  read: boolean;
  createdAt: string;
}

interface DbNotification {
  id: string;
  type: NotificationType;
  message: string;
  event_id: string | null;
  read: boolean;
  created_at: string;
}

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user.id;
}

/** The signed-in user's notifications, newest first. */
export async function fetchMyNotifications(): Promise<AppNotification[]> {
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, message, event_id, read, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data as DbNotification[]).map((n) => ({
    id: n.id,
    type: n.type,
    message: n.message,
    eventId: n.event_id,
    read: n.read,
    createdAt: n.created_at,
  }));
}

export async function markNotificationsRead(): Promise<void> {
  const uid = await currentUserId();
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', uid)
    .eq('read', false);
  if (error) throw error;
}

const ACTIVE_RSVP = ['going', 'interested', 'waitlisted', 'pending_approval'];

/** Fan out an in-app notification to an event's attendees (never the actor). */
export async function notifyEventAttendees(
  eventId: string,
  type: NotificationType,
  message: string,
): Promise<void> {
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from('rsvps')
    .select('user_id')
    .eq('event_id', eventId)
    .in('status', ACTIVE_RSVP);
  if (error) throw error;
  const rows = (data as { user_id: string }[])
    .map((r) => r.user_id)
    .filter((id) => id !== uid)
    .map((id) => ({ user_id: id, type, event_id: eventId, from_user_id: uid, message, read: false }));
  if (rows.length === 0) return;
  const { error: insErr } = await supabase.from('notifications').insert(rows);
  if (insErr) throw insErr;
}

export function useMyNotifications() {
  return useQuery({ queryKey: ['notifications'], queryFn: fetchMyNotifications });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
