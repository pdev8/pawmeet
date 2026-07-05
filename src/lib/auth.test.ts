import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: { auth: { signOut: vi.fn() }, rpc: vi.fn() },
}));

import { deleteAccount, signOut } from './auth';
import { supabase } from './supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authSignOut = supabase.auth.signOut as any;

beforeEach(() => {
  vi.clearAllMocks();
  authSignOut.mockResolvedValue({ error: null });
});

describe('deleteAccount', () => {
  it('calls the delete RPC then signs out', async () => {
    rpc.mockResolvedValue({ error: null });
    await deleteAccount();
    expect(rpc).toHaveBeenCalledWith('delete_current_user');
    expect(authSignOut).toHaveBeenCalled();
  });

  it('throws and does not sign out when the RPC errors', async () => {
    rpc.mockResolvedValue({ error: new Error('denied') });
    await expect(deleteAccount()).rejects.toThrow('denied');
    expect(authSignOut).not.toHaveBeenCalled();
  });
});

describe('signOut', () => {
  it('delegates to supabase auth signOut', async () => {
    await signOut();
    expect(authSignOut).toHaveBeenCalled();
  });
});
