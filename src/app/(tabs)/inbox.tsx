import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OwnerPetBadge } from '@/components/avatar';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { BottomTabInset, Fonts, Radii, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { timeAgo } from '@/lib/dates';
import { useStore } from '@/lib/store';
import type { NotificationType } from '@/lib/types';

const TYPE_ICONS: Record<NotificationType, string> = {
  request_received: 'person.crop.circle.badge.questionmark',
  rsvp_approved: 'checkmark.circle.fill',
  request_declined: 'xmark.circle',
  comment: 'bubble.left.fill',
  reply: 'arrowshape.turn.up.left.fill',
  waitlist_promoted: 'sparkles',
  event_cancelled: 'calendar.badge.exclamationmark',
};

export default function InboxScreen() {
  const p = usePalette();
  const router = useRouter();
  const store = useStore();

  // Pending requests on events I host.
  const requests = store.rsvps
    .filter((r) => {
      const ev = store.events[r.eventId];
      return (
        r.status === 'pending_approval' &&
        ev &&
        ev.hostId === store.currentUserId &&
        ev.status === 'active'
      );
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const notifications = [...store.notifications].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: p.text }]}>Inbox</Text>
        {hasUnread ? (
          <Chip small label="Mark all read" onPress={store.markAllNotificationsRead} />
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: BottomTabInset + Spacing.four }]}>
        {requests.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: p.textSecondary }]}>
              REQUESTS TO JOIN
            </Text>
            {requests.map((r) => {
              const user = store.users[r.userId];
              const ev = store.events[r.eventId];
              if (!user || !ev) return null;
              const pet = r.petIds.map((id) => store.pets[id]).find(Boolean);
              return (
                <View
                  key={r.id}
                  style={[styles.card, { backgroundColor: p.card, borderColor: p.separator }]}>
                  <OwnerPetBadge user={user} pet={pet} size={44} />
                  <View style={styles.cardText}>
                    <Text style={[styles.cardTitle, { color: p.text }]}>
                      {user.displayName}
                      <Text style={{ color: p.textSecondary, fontWeight: '400' }}>
                        {' '}wants to join{' '}
                      </Text>
                      {ev.title}
                    </Text>
                    {pet ? (
                      <Text style={[styles.cardMeta, { color: p.textSecondary }]}>
                        Bringing {pet.name} ({pet.breed})
                      </Text>
                    ) : null}
                    <View style={styles.actions}>
                      <Chip small label="Approve" selected onPress={() => store.approveRequest(r.id)} />
                      <Chip small label="Decline" onPress={() => store.declineRequest(r.id)} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: p.textSecondary }]}>ACTIVITY</Text>
          {notifications.length === 0 ? (
            <EmptyState
              sf="bell"
              title="Nothing yet"
              subtitle="RSVP to an event or post your own and activity will show up here."
            />
          ) : (
            notifications.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => n.eventId && router.push(`/event/${n.eventId}`)}
                style={({ pressed }) => [
                  styles.notifRow,
                  { backgroundColor: pressed ? p.cardPressed : 'transparent' },
                ]}>
                <View style={[styles.notifIcon, { backgroundColor: p.accentSoft }]}>
                  <Icon sf={TYPE_ICONS[n.type]} size={16} color={p.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.notifText,
                      { color: p.text, fontWeight: n.read ? '400' : '700' },
                    ]}>
                    {n.message}
                  </Text>
                  <Text style={[styles.notifTime, { color: p.textSecondary }]}>
                    {timeAgo(n.createdAt)}
                  </Text>
                </View>
                {!n.read ? <View style={[styles.unreadDot, { backgroundColor: p.accent }]} /> : null}
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  title: { fontSize: 32, fontWeight: '800', fontFamily: Fonts?.rounded },
  body: { padding: Spacing.three, gap: Spacing.four },
  section: { gap: Spacing.two },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  card: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700', lineHeight: 19 },
  cardMeta: { fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: 4,
    borderRadius: Radii.sm,
  },
  notifIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifText: { fontSize: 14, lineHeight: 19 },
  notifTime: { fontSize: 12, marginTop: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
});
