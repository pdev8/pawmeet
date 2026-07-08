import { useMutation } from '@tanstack/react-query';

import { supabase } from './supabase';

export type ReportTarget = 'event' | 'user' | 'comment' | 'review';

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user.id;
}

/** File a moderation report. Regular clients can insert but never read the queue
 * (RLS: insert-own, no select) — reviewing happens in the admin console. */
export async function reportContent(
  targetType: ReportTarget,
  targetId: string,
  reason?: string,
): Promise<void> {
  const uid = await currentUserId();
  const { error } = await supabase.from('reports').insert({
    reporter_id: uid,
    target_type: targetType,
    target_id: targetId,
    reason: reason?.trim() || null,
  });
  if (error) throw error;
}

export function useReportContent() {
  return useMutation({
    mutationFn: ({
      targetType,
      targetId,
      reason,
    }: {
      targetType: ReportTarget;
      targetId: string;
      reason?: string;
    }) => reportContent(targetType, targetId, reason),
  });
}
