import { StyleSheet, Text, View } from 'react-native';

import { Chip } from './chip';
import { Icon } from './icon';
import { Fonts, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';

export function EmptyState({
  sf,
  title,
  subtitle,
  ctaLabel,
  onCta,
}: {
  sf: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  const p = usePalette();
  return (
    <View style={styles.wrap}>
      <Icon sf={sf} size={44} color={p.textSecondary} />
      <Text style={[styles.title, { color: p.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: p.textSecondary }]}>{subtitle}</Text>
      {ctaLabel && onCta ? <Chip label={ctaLabel} selected onPress={onCta} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  title: { fontSize: 18, fontWeight: '700', fontFamily: Fonts?.rounded, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
