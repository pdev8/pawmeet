import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BadgeRow } from './badge-row';
import { Chip } from './chip';
import { Icon } from './icon';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { fmtTime, relDay } from '@/lib/dates';
import { fmtDistance } from '@/lib/geo';
import { attendeeBadges, commentCount, isFavorite, spotsLeft, type AttendeeBadge } from '@/lib/selectors';
import { useStore } from '@/lib/store';
import { RECURRENCE_LABELS, VENUE_ICONS, VENUE_LABELS, type PetEvent } from '@/lib/types';

export function EventCard({
  event,
  distanceMi,
  goingCount: goingCountOverride,
  badges: badgesOverride,
}: {
  event: PetEvent;
  distanceMi: number;
  // Supabase-sourced Discover passes real counts; without them we read the mock store.
  goingCount?: number;
  badges?: AttendeeBadge[];
}) {
  const p = usePalette();
  const router = useRouter();
  const state = useStore();
  const local = attendeeBadges(state, event.id);
  const badges = badgesOverride ?? local.badges;
  const goingCount = goingCountOverride ?? local.goingCount;
  const comments = commentCount(state, event.id);
  const left = spotsLeft(state, event);
  const favorite = isFavorite(state, event.id);

  return (
    <Pressable
      onPress={() => router.push(`/event/${event.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? p.cardPressed : p.card, borderColor: p.separator },
      ]}>
      <View>
        <Image
          source={{ uri: event.coverPhotoUrl }}
          style={styles.cover}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.coverChips}>
          <Chip small label={VENUE_LABELS[event.venueType]} sf={VENUE_ICONS[event.venueType]} />
          {event.breedFocus ? <Chip small label={event.breedFocus} sf="pawprint.fill" /> : null}
        </View>
        <Pressable
          onPress={() => useStore.getState().toggleFavorite(event.id)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={favorite ? 'Remove from saved' : 'Save event'}
          style={[styles.heart, { backgroundColor: p.overlay }]}>
          <Icon
            sf={favorite ? 'heart.fill' : 'heart'}
            size={18}
            color={favorite ? p.accent : '#fff'}
          />
        </Pressable>
        <View style={styles.coverBottomLeft}>
          {left !== null && left <= 0 ? (
            <View style={[styles.fullTag, { backgroundColor: p.overlay }]}>
              <Text style={styles.fullTagText}>Full · waitlist open</Text>
            </View>
          ) : null}
          {event.recurrence ? (
            <Chip small label={RECURRENCE_LABELS[event.recurrence]} sf="repeat" />
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <Text style={[styles.meta, { color: p.accent }]}>
          {relDay(event.startsAt)} · {fmtTime(event.startsAt)}
          <Text style={{ color: p.textSecondary }}>  ·  {fmtDistance(distanceMi)}</Text>
        </Text>
        <Text style={[styles.title, { color: p.text }]} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={[styles.area, { color: p.textSecondary }]} numberOfLines={1}>
          {event.areaLabel}
        </Text>
        <View style={styles.footer}>
          <BadgeRow badges={badges} goingCount={goingCount} size={32} />
          {comments > 0 ? (
            <View style={styles.commentCount}>
              <Icon sf="bubble.left.fill" size={13} color={p.textSecondary} />
              <Text style={[styles.commentText, { color: p.textSecondary }]}>{comments}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cover: { width: '100%', aspectRatio: 16 / 9 },
  coverChips: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    // Stop before the heart button (34 + gap) so top chips never sit under it.
    right: Spacing.three + 34 + 8,
    flexDirection: 'row',
    gap: 6,
  },
  heart: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBottomLeft: {
    position: 'absolute',
    bottom: Spacing.two,
    left: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fullTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  fullTagText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  body: { padding: Spacing.three, gap: 4 },
  meta: { fontSize: 13, fontWeight: '700', fontFamily: Fonts?.rounded },
  title: { fontSize: 19, fontWeight: '700', fontFamily: Fonts?.rounded },
  area: { fontSize: 13 },
  footer: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentText: { fontSize: 13, fontWeight: '600' },
});
