import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OwnerPetBadge } from '@/components/avatar';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { useEvent } from '@/lib/use-events';
import { usePetsForOwners } from '@/lib/use-pets';
import { useCurrentUserId, useEventRsvps, useHostRequestActions } from '@/lib/use-rsvps';
import type { Pet, RsvpStatus, User } from '@/lib/types';

const GROUPS: { key: RsvpStatus; label: string }[] = [
  { key: 'pending_approval', label: 'Requests to join' },
  { key: 'going', label: 'Going' },
  { key: 'waitlisted', label: 'Waitlist' },
  { key: 'interested', label: 'Interested' },
];

export default function ManageEventScreen() {
  const p = usePalette();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event } = useEvent(id);
  const { data: uid } = useCurrentUserId();
  const { data: rsvps = [] } = useEventRsvps(id);
  const requestActions = useHostRequestActions();

  const ownerIds = [...new Set(rsvps.map((r) => r.userId))];
  const { data: pets = [] } = usePetsForOwners(ownerIds);
  const petsByOwner = pets.reduce<Record<string, Pet[]>>((acc, pet) => {
    (acc[pet.ownerId] ??= []).push(pet);
    return acc;
  }, {});

  const isHost = !!event && !!uid && event.hostId === uid;
  const going = rsvps.filter((r) => r.status === 'going');
  const goingDogs = going.reduce((n, r) => n + (petsByOwner[r.userId]?.length ?? 0), 0);

  return (
    <ScrollView style={[styles.screen, { backgroundColor: p.background }]} contentContainerStyle={styles.body}>
      <Stack.Screen options={{ title: 'Manage event' }} />

      {!event || !isHost ? (
        <EmptyState sf="lock" title="Host only" subtitle="Only the event host can manage attendees." />
      ) : (
        <>
          <Text style={[styles.title, { color: p.text }]}>{event.title}</Text>

          <View style={styles.stats}>
            <View style={[styles.stat, { backgroundColor: p.card, borderColor: p.separator }]}>
              <Text style={[styles.statNum, { color: p.text }]}>{going.length}</Text>
              <Text style={[styles.statLabel, { color: p.textSecondary }]}>
                going{event.capacity != null ? ` / ${event.capacity}` : ''}
              </Text>
            </View>
            <View style={[styles.stat, { backgroundColor: p.card, borderColor: p.separator }]}>
              <Text style={[styles.statNum, { color: p.text }]}>{goingDogs}</Text>
              <Text style={[styles.statLabel, { color: p.textSecondary }]}>dogs</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: p.card, borderColor: p.separator }]}>
              <Text style={[styles.statNum, { color: p.text }]}>{going.length + goingDogs}</Text>
              <Text style={[styles.statLabel, { color: p.textSecondary }]}>headcount</Text>
            </View>
          </View>

          {GROUPS.map(({ key, label }) => {
            const rows = rsvps.filter((r) => r.status === key);
            if (rows.length === 0) return null;
            return (
              <View key={key} style={styles.section}>
                <Text style={[styles.sectionLabel, { color: p.textSecondary }]}>
                  {label.toUpperCase()} ({rows.length})
                </Text>
                {rows.map((r) => {
                  const user: User = {
                    id: r.userId,
                    displayName: r.name ?? 'Someone',
                    avatarUrl: r.avatar ?? '',
                    homeArea: '',
                  };
                  const ownerPets = petsByOwner[r.userId] ?? [];
                  const req = {
                    rsvpId: r.id,
                    eventId: event.id,
                    eventTitle: event.title,
                    capacity: event.capacity ?? null,
                    userId: r.userId,
                    name: user.displayName,
                    avatar: r.avatar ?? null,
                  };
                  return (
                    <View key={r.id} style={[styles.row, { backgroundColor: p.card, borderColor: p.separator }]}>
                      <Pressable
                        style={styles.rowMain}
                        onPress={() => router.push(`/user/${r.userId}`)}>
                        <OwnerPetBadge user={user} pet={ownerPets[0]} size={40} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.name, { color: p.text }]}>{user.displayName}</Text>
                          <Text style={[styles.pets, { color: p.textSecondary }]} numberOfLines={1}>
                            {ownerPets.length
                              ? ownerPets.map((pt) => `${pt.name} (${pt.breed})`).join(', ')
                              : 'No pets listed'}
                          </Text>
                        </View>
                      </Pressable>
                      {key === 'pending_approval' ? (
                        <View style={styles.actions}>
                          <Chip small label="Approve" selected onPress={() => requestActions.approve.mutate(req)} />
                          <Chip small label="Decline" onPress={() => requestActions.decline.mutate(req)} />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            );
          })}

          {rsvps.length === 0 ? (
            <EmptyState sf="person.2" title="No RSVPs yet" subtitle="Attendees will show up here as they RSVP." />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: Spacing.four, gap: Spacing.three },
  title: { fontSize: 22, fontWeight: '800', fontFamily: Fonts?.rounded },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: {
    flex: 1,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    alignItems: 'center',
    gap: 2,
  },
  statNum: { fontSize: 26, fontWeight: '800', fontFamily: Fonts?.rounded },
  statLabel: { fontSize: 12, fontWeight: '600' },
  section: { gap: Spacing.two },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { fontSize: 15, fontWeight: '700' },
  pets: { fontSize: 12.5, marginTop: 1 },
  actions: { flexDirection: 'row', gap: 6 },
});
