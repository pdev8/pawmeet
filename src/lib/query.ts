import { QueryClient } from '@tanstack/react-query';

// Single app-wide client for server-cache (Supabase reads/writes).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});
