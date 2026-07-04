import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { DEFAULT_CENTER, DEFAULT_CENTER_LABEL } from '@/lib/geo';
import { useStore } from '@/lib/store';

export default function RootLayout() {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? Colors.dark : Colors.light;
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const hydrated = useStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hydrated) return;
    const s = useStore.getState();
    if (Object.keys(s.events).length === 0) {
      s.reseed(DEFAULT_CENTER, DEFAULT_CENTER_LABEL, false);
    }
    s.archiveSweep();
  }, [hydrated]);

  return (
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
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
