import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from './supabase';

/**
 * Tracks the Supabase auth session. `loading` is true until the initial
 * session check resolves; after that `session` updates live on sign-in/out
 * (and on background token refresh) via onAuthStateChange.
 */
export function useAuth(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Permanently delete the signed-in user's account and all their data (via the
 * delete_current_user RPC + ON DELETE CASCADE), then end the local session.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_current_user');
  if (error) throw error;
  await supabase.auth.signOut();
}
