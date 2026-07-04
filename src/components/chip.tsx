import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { Icon } from './icon';
import { Fonts, Radii } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';

export function Chip({
  label,
  selected = false,
  onPress,
  sf,
  small = false,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  sf?: string;
  small?: boolean;
  style?: ViewStyle;
}) {
  const p = usePalette();
  const bg = selected ? p.accent : p.chipBg;
  const fg = selected ? p.onAccent : p.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        small && styles.small,
        { backgroundColor: bg, opacity: pressed ? 0.8 : 1 },
        style,
      ]}>
      {sf ? <Icon sf={sf} size={small ? 12 : 14} color={fg} /> : null}
      <Text style={[styles.label, small && styles.smallLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.lg,
  },
  small: { paddingHorizontal: 10, paddingVertical: 5 },
  label: { fontSize: 14, fontWeight: '600', fontFamily: Fonts?.rounded },
  smallLabel: { fontSize: 12 },
});
