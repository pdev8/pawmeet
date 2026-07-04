import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1C1917',
    textSecondary: '#6B6560',
    background: '#FAF8F5',
    card: '#FFFFFF',
    cardPressed: '#F3EFE9',
    separator: 'rgba(28,25,23,0.08)',
    accent: '#D97706',
    accentSoft: 'rgba(217,119,6,0.12)',
    onAccent: '#FFFFFF',
    success: '#16A34A',
    danger: '#DC2626',
    glassFallback: 'rgba(255,255,255,0.78)',
    chipBg: 'rgba(28,25,23,0.06)',
    overlay: 'rgba(0,0,0,0.35)',
  },
  dark: {
    text: '#F5F2EE',
    textSecondary: '#A8A29E',
    background: '#100F0D',
    card: '#1C1A17',
    cardPressed: '#26231F',
    separator: 'rgba(245,242,238,0.08)',
    accent: '#F59E0B',
    accentSoft: 'rgba(245,158,11,0.16)',
    onAccent: '#231A05',
    success: '#4ADE80',
    danger: '#F87171',
    glassFallback: 'rgba(22,20,18,0.78)',
    chipBg: 'rgba(245,242,238,0.08)',
    overlay: 'rgba(0,0,0,0.45)',
  },
} as const;

export type Palette = { [K in keyof typeof Colors.light]: string };

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
} as const;

export const BottomTabInset = Platform.select({ ios: 84, android: 96 }) ?? 84;
