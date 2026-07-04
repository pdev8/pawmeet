import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Radii, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { fmtDay, fmtTime } from '@/lib/dates';
import type { PetEvent, RsvpStatus } from '@/lib/types';

const STATUS_LABELS: Partial<Record<RsvpStatus, string>> = {
  going: 'Going',
  interested: 'Interested',
  pending_approval: 'Requested',
  waitlisted: 'Waitlist',
};

/** Compact event row for Profile lists. */
export function EventRow({
  event,
  rsvpStatus,
  right,
}: {
  event: PetEvent;
  rsvpStatus?: RsvpStatus;
  right?: ReactNode;
}) {
  const p = usePalette();
  const router = useRouter();
  const statusLabel = rsvpStatus ? STATUS_LABELS[rsvpStatus] : undefined;
  return (
    <Pressable
      onPress={() => router.push(`/event/${event.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? p.cardPressed : p.card, borderColor: p.separator },
      ]}>
      <Image source={{ uri: event.coverPhotoUrl }} style={styles.thumb} contentFit="cover" />
      <View style={styles.info}>
        <Text style={[styles.date, { color: p.accent }]}>
          {fmtDay(event.startsAt)} · {fmtTime(event.startsAt)}
        </Text>
        <Text style={[styles.title, { color: p.text }]} numberOfLines={1}>
          {event.title}
        </Text>
        {statusLabel ? (
          <Text style={[styles.status, { color: p.textSecondary }]}>{statusLabel}</Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 56, height: 56, borderRadius: Radii.sm },
  info: { flex: 1, gap: 1 },
  date: { fontSize: 12, fontWeight: '700', fontFamily: Fonts?.rounded },
  title: { fontSize: 15, fontWeight: '600' },
  status: { fontSize: 12, fontWeight: '600' },
});
