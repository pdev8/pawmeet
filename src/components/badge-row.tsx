import { StyleSheet, Text, View } from 'react-native';

import { OwnerPetBadge } from './avatar';
import { Fonts } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import type { AttendeeBadge } from '@/lib/selectors';

/** Overlapping stack of attendee badges + "N going". */
export function BadgeRow({
  badges,
  goingCount,
  size = 36,
}: {
  badges: AttendeeBadge[];
  goingCount: number;
  size?: number;
}) {
  const p = usePalette();
  if (goingCount === 0) {
    return (
      <Text style={[styles.label, { color: p.textSecondary }]}>
        Be the first to RSVP
      </Text>
    );
  }
  const extra = goingCount - badges.length;
  return (
    <View style={styles.row} accessibilityLabel={`${goingCount} going`}>
      <View style={styles.stack}>
        {badges.map((b, i) => (
          <View
            key={b.user.id}
            style={{ marginLeft: i === 0 ? 0 : -size * 0.35, zIndex: badges.length - i }}>
            <OwnerPetBadge user={b.user} pet={b.pet} size={size} />
          </View>
        ))}
      </View>
      <Text style={[styles.label, { color: p.textSecondary }]}>
        {badges.length > 0 && extra > 0 ? `+${extra} more going` : `${goingCount} going`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stack: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600', fontFamily: Fonts?.rounded },
});
