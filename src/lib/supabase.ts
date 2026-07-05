import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Public config — the anon key is safe to ship in the client; row-level
// security (see supabase/migrations) is what actually protects data. Values
// come from env (EXPO_PUBLIC_* are inlined at build time); see .env.example.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env. Copy .env.example to .env and set ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the session on-device and refresh it in the background.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection in a native app (that's for web OAuth redirects).
    detectSessionInUrl: false,
  },
});
