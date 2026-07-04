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
import { attendeeBadges, commentCount, spotsLeft } from '@/lib/selectors';
import { useStore } from '@/lib/store';
import { VENUE_ICONS, VENUE_LABELS, type PetEvent } from '@/lib/types';

export function EventCard({ event, distanceMi }: { event: PetEvent; distanceMi: number }) {
  const p = usePalette();
  const router = useRouter();
  const state = useStore();
  const { badges, goingCount } = attendeeBadges(state, event.id);
  const comments = commentCount(state, event.id);
  const left = spotsLeft(state, event);

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
        {left !== null && left <= 0 ? (
          <View style={[styles.fullTag, { backgroundColor: p.overlay }]}>
            <Text style={styles.fullTagText}>Full · waitlist open</Text>
          </View>
        ) : null}
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
    flexDirection: 'row',
    gap: 6,
  },
  fullTag: {
    position: 'absolute',
    bottom: Spacing.two,
    left: Spacing.three,
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
