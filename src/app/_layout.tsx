import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { DEFAULT_CENTER, DEFAULT_CENTER_LABEL } from '@/lib/geo';
import { queryClient } from '@/lib/query';
import { useStore } from '@/lib/store';

export default function RootLayout() {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? Colors.dark : Colors.light;
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const hydrated = useStore((s) => s.hasHydrated);
  const { session, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!hydrated) return;
    const s = useStore.getState();
    if (Object.keys(s.events).length === 0) {
      s.reseed(DEFAULT_CENTER, DEFAULT_CENTER_LABEL, false);
    }
    s.archiveSweep();
  }, [hydrated]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        value={{
          ...base,
          colors: {
            ...base.colors,
            primary: palette.accent,
            background: palette.background,
            card: palette.background,
            text: palette.text,
          },
        }}>
        {authLoading ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.background,
          }}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : session ? (
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
          <Stack.Screen
            name="map"
            options={{ headerShown: false, presentation: 'fullScreenModal' }}
          />
        </Stack>
        ) : (
          <AuthScreen />
        )}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
