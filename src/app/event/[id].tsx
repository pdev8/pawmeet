import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OwnerPetBadge } from '@/components/avatar';
import { Chip } from '@/components/chip';
import { CommentsSection, SupabaseCommentsSection } from '@/components/comments';
import { Glass } from '@/components/glass';
import { Icon } from '@/components/icon';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { fmtRange } from '@/lib/dates';
import { fmtDistance } from '@/lib/geo';
import {
  eventDistanceMi,
  goingRsvps,
  interestedRsvps,
  isFavorite,
  isHost,
  myRsvp,
  pendingRsvps,
  spotsLeft,
  visibleAddress,
} from '@/lib/selectors';
import { useEvent } from '@/lib/use-events';
import {
  goingCountOf,
  useCurrentUserId,
  useEventRsvps,
  useRsvpActions,
} from '@/lib/use-rsvps';
import { useStore } from '@/lib/store';
import {
  RECURRENCE_LABELS,
  VENUE_ICONS,
  VENUE_LABELS,
  type PetEvent,
  type User,
} from '@/lib/types';

function AttendeeStrip({
  title,
  userIds,
  onTapUser,
}: {
  title: string;
  userIds: string[];
  onTapUser: (u: User) => void;
}) {
  const p = usePalette();
  const store = useStore();
  if (userIds.length === 0) return null;
  return (
    <View style={{ gap: Spacing.two }}>
      <Text style={[styles.sectionLabel, { color: p.textSecondary }]}>
        {title.toUpperCase()} ({userIds.length})
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.strip}>
          {userIds.map((uid) => {
            const user = store.users[uid];
            if (!user) return null;
            const pet = Object.values(store.pets).find((x) => x.ownerId === uid);
            return (
              <Pressable key={uid} onPress={() => onTapUser(user)} style={styles.stripItem}>
                <OwnerPetBadge user={user} pet={pet} size={48} />
                <Text style={[styles.stripName, { color: p.textSecondary }]} numberOfLines={1}>
                  {user.displayName.split(' ')[0]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// RSVP bar for real (Supabase) events — mirrors RsvpBar's states using live
// data. Host approve/decline still happens via the (mock) Inbox for now.
function SupabaseRsvpBar({ event }: { event: PetEvent }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { data: uid } = useCurrentUserId();
  const { data: rsvps = [] } = useEventRsvps(event.id);
  const actions = useRsvpActions(event.id);
  const pad = { paddingBottom: Math.max(insets.bottom, Spacing.three) };

  if (event.status !== 'active') return null;

  const host = event.hostId === uid;
  const mine = rsvps.find(
    (r) => r.userId === uid && r.status !== 'cancelled' && r.status !== 'declined_by_host',
  );
  const goingCount = goingCountOf(rsvps);
  const left = event.capacity != null ? Math.max(0, event.capacity - goingCount) : null;
  const isFull = left !== null && left <= 0;
  const needsApproval = event.rsvpMode === 'host_approves';
  const join = () =>
    needsApproval && !isFull
      ? actions.requestJoin.mutate()
      : actions.go.mutate({ capacity: event.capacity, goingCount });

  if (host) {
    return (
      <Glass style={[styles.rsvpBar, pad]}>
        <View style={styles.hostBarText}>
          <Text style={[styles.rsvpState, { color: p.text }]}>You&apos;re hosting</Text>
        </View>
      </Glass>
    );
  }

  if (mine?.status === 'going' || mine?.status === 'interested') {
    return (
      <Glass style={[styles.rsvpBar, pad]}>
        <View style={styles.hostBarText}>
          <Text style={[styles.rsvpState, { color: p.success }]}>
            {mine.status === 'going' ? "You're going ✓" : "You're interested"}
          </Text>
        </View>
        {mine.status === 'interested' ? <Chip label="Go" selected onPress={join} /> : null}
        <Chip label="Cancel" onPress={() => actions.cancel.mutate()} />
      </Glass>
    );
  }

  if (mine?.status === 'pending_approval') {
    return (
      <Glass style={[styles.rsvpBar, pad]}>
        <View style={styles.hostBarText}>
          <Text style={[styles.rsvpState, { color: p.accent }]}>Request sent</Text>
          <Text style={[styles.rsvpSub, { color: p.textSecondary }]}>Waiting for the host</Text>
        </View>
        <Chip label="Withdraw" onPress={() => actions.cancel.mutate()} />
      </Glass>
    );
  }

  if (mine?.status === 'waitlisted') {
    return (
      <Glass style={[styles.rsvpBar, pad]}>
        <View style={styles.hostBarText}>
          <Text style={[styles.rsvpState, { color: p.accent }]}>You&apos;re on the waitlist</Text>
        </View>
        <Chip label="Leave" onPress={() => actions.cancel.mutate()} />
      </Glass>
    );
  }

  return (
    <Glass style={[styles.rsvpBar, pad]}>
      <Chip
        label={isFull ? 'Join waitlist' : needsApproval ? 'Request to join' : 'Going'}
        sf={isFull ? 'clock.fill' : 'checkmark.circle.fill'}
        selected
        style={styles.rsvpBtn}
        onPress={join}
      />
      <Chip
        label="Interested"
        sf="star"
        style={styles.rsvpBtn}
        onPress={() => actions.interested.mutate()}
      />
    </Glass>
  );
}

function RsvpBar({ event }: { event: PetEvent }) {
  const p = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const mine = myRsvp(store, event.id);
  const host = isHost(store, event);
  const left = spotsLeft(store, event);
  const pending = pendingRsvps(store, event.id).length;

  const pad = { paddingBottom: Math.max(insets.bottom, Spacing.three) };

  if (event.status === 'cancelled') return null;

  if (event.status === 'archived') {
    if (!host) return null;
    return (
      <Glass style={[styles.rsvpBar, pad]}>
        <Chip
          label="Host it again"
          sf="arrow.clockwise"
          selected
          style={styles.rsvpBtn}
          onPress={() => {
            store.setDraft({
              title: event.title,
              description: event.description,
              coverPhotoUrl: event.coverPhotoUrl,
              venueType: event.venueType,
              address: event.address,
              areaLabel: event.areaLabel,
              breedFocus: event.breedFocus,
              capacity: event.capacity,
              rsvpMode: event.rsvpMode,
            });
            router.push('/post');
          }}
        />
      </Glass>
    );
  }

  if (host) {
    return (
      <Glass style={[styles.rsvpBar, pad]}>
        <View style={styles.hostBarText}>
          <Text style={[styles.rsvpState, { color: p.text }]}>You're hosting</Text>
          {pending > 0 ? (
            <Text style={[styles.rsvpSub, { color: p.accent }]}>
              {pending} request{pending > 1 ? 's' : ''} waiting
            </Text>
          ) : null}
        </View>
        {pending > 0 ? (
          <Chip label="Review" selected onPress={() => router.push('/inbox')} />
        ) : null}
        <Chip
          label="Cancel event"
          onPress={() =>
            Alert.alert('Cancel this event?', 'Attendees will see it as cancelled.', [
              { text: 'Keep it', style: 'cancel' },
              {
                text: 'Cancel event',
                style: 'destructive',
                onPress: () => store.cancelEvent(event.id),
              },
            ])
          }
        />
      </Glass>
    );
  }

  if (mine?.status === 'going' || mine?.status === 'interested') {
    return (
      <Glass style={[styles.rsvpBar, pad]}>
        <View style={styles.hostBarText}>
          <Text style={[styles.rsvpState, { color: p.success }]}>
            {mine.status === 'going' ? "You're going ✓" : "You're interested"}
          </Text>
          {mine.status === 'going' && event.venueType === 'home_backyard' ? (
            <Text style={[styles.rsvpSub, { color: p.textSecondary }]}>Address unlocked below</Text>
          ) : null}
        </View>
        {mine.status === 'interested' ? (
          <Chip
            label="Go"
            selected
            onPress={() =>
              event.rsvpMode === 'host_approves'
                ? store.requestJoin(event.id)
                : store.rsvp(event.id, 'going')
            }
          />
        ) : null}
        <Chip label="Cancel" onPress={() => store.cancelRsvp(event.id)} />
      </Glass>
    );
  }

  if (mine?.status === 'pending_approval') {
    return (
      <Glass style={[styles.rsvpBar, pad]}>
        <View style={styles.hostBarText}>
          <Text style={[styles.rsvpState, { color: p.accent }]}>Request sent</Text>
          <Text style={[styles.rsvpSub, { color: p.textSecondary }]}>
            Waiting for the host to approve
          </Text>
        </View>
        <Chip label="Withdraw" onPress={() => store.cancelRsvp(event.id)} />
      </Glass>
    );
  }

  if (mine?.status === 'waitlisted') {
    return (
      <Glass style={[styles.rsvpBar, pad]}>
        <View style={styles.hostBarText}>
          <Text style={[styles.rsvpState, { color: p.accent }]}>You're on the waitlist</Text>
          <Text style={[styles.rsvpSub, { color: p.textSecondary }]}>
            We'll bump you in if a spot opens
          </Text>
        </View>
        <Chip label="Leave" onPress={() => store.cancelRsvp(event.id)} />
      </Glass>
    );
  }

  const isFull = left !== null && left <= 0;
  const needsApproval = event.rsvpMode === 'host_approves';
  return (
    <Glass style={[styles.rsvpBar, pad]}>
      <Chip
        label={isFull ? 'Join waitlist' : needsApproval ? 'Request to join' : 'Going'}
        sf={isFull ? 'clock.fill' : 'checkmark.circle.fill'}
        selected
        style={styles.rsvpBtn}
        onPress={() =>
          needsApproval && !isFull ? store.requestJoin(event.id) : store.rsvp(event.id, 'going')
        }
      />
      <Chip
        label="Interested"
        sf="star"
        style={styles.rsvpBtn}
        onPress={() => store.rsvp(event.id, 'interested')}
      />
    </Glass>
  );
}

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const [profileUser, setProfileUser] = useState<User | null>(null);

  // Read the event from Supabase, falling back to the mock store for the seed
  // events still shown on Profile during the data-layer migration.
  const { data: sbEvent } = useEvent(id);
  const event = sbEvent ?? (id ? store.events[id] : undefined);
  if (!event) {
    return (
      <View style={[styles.screen, { backgroundColor: p.background, justifyContent: 'center' }]}>
        <Text style={{ color: p.textSecondary, textAlign: 'center' }}>Event not found.</Text>
      </View>
    );
  }

  const host = store.users[event.hostId];
  const hostPet = Object.values(store.pets).find((x) => x.ownerId === event.hostId);
  const going = goingRsvps(store, event.id).map((r) => r.userId);
  const interested = interestedRsvps(store, event.id).map((r) => r.userId);
  const address = visibleAddress(store, event);
  const dist = eventDistanceMi(event, store.center);
  const left = spotsLeft(store, event);
  const favorite = isFavorite(store, event.id);
  const hostedCount = Object.values(store.events).filter(
    (e) => e.hostId === event.hostId,
  ).length;

  return (
    <View style={[styles.screen, { backgroundColor: p.background }]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
          <View>
            <Image source={{ uri: event.coverPhotoUrl }} style={styles.hero} contentFit="cover" />
            <View style={styles.heroChips}>
              <Chip small label={VENUE_LABELS[event.venueType]} sf={VENUE_ICONS[event.venueType]} />
              {event.breedFocus ? (
                <Chip small label={event.breedFocus} sf="pawprint.fill" />
              ) : null}
            </View>
            <Pressable
              onPress={() => store.toggleFavorite(event.id)}
              accessibilityRole="button"
              accessibilityLabel={favorite ? 'Remove from saved' : 'Save event'}
              style={styles.heroFav}>
              <Glass style={styles.heroFavGlass}>
                <Icon
                  sf={favorite ? 'heart.fill' : 'heart'}
                  size={20}
                  color={favorite ? p.accent : p.text}
                />
              </Glass>
            </Pressable>
          </View>

          <View style={styles.content}>
            {event.status !== 'active' ? (
              <View
                style={[
                  styles.banner,
                  { backgroundColor: event.status === 'cancelled' ? p.danger : p.chipBg },
                ]}>
                <Icon
                  sf={event.status === 'cancelled' ? 'xmark.circle.fill' : 'archivebox.fill'}
                  size={15}
                  color={event.status === 'cancelled' ? '#fff' : p.textSecondary}
                />
                <Text
                  style={[
                    styles.bannerText,
                    { color: event.status === 'cancelled' ? '#fff' : p.textSecondary },
                  ]}>
                  {event.status === 'cancelled'
                    ? 'This event was cancelled'
                    : 'This event is archived'}
                </Text>
              </View>
            ) : null}

            <Text style={[styles.title, { color: p.text }]}>{event.title}</Text>

            <View style={styles.infoRow}>
              <Icon sf="calendar" size={17} color={p.accent} />
              <Text style={[styles.infoText, { color: p.text }]}>
                {fmtRange(event.startsAt, event.endsAt)}
              </Text>
            </View>
            {event.recurrence ? (
              <View style={styles.infoRow}>
                <Icon sf="repeat" size={17} color={p.accent} />
                <Text style={[styles.infoText, { color: p.text }]}>
                  Repeats {RECURRENCE_LABELS[event.recurrence].toLowerCase()}
                </Text>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Icon sf="mappin.and.ellipse" size={17} color={p.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoText, { color: p.text }]}>
                  {address.text}
                  <Text style={{ color: p.textSecondary }}>  ·  {fmtDistance(dist)}</Text>
                </Text>
                {address.isApproximate && event.status === 'active' ? (
                  <Text style={[styles.privacyNote, { color: p.textSecondary }]}>
                    Approximate area — exact address is shared once you're approved.
                  </Text>
                ) : null}
              </View>
            </View>
            {left !== null ? (
              <View style={styles.infoRow}>
                <Icon sf="person.2.fill" size={17} color={p.accent} />
                <Text style={[styles.infoText, { color: left === 0 ? p.danger : p.text }]}>
                  {left === 0 ? 'Full — waitlist open' : `${left} of ${event.capacity} spots left`}
                </Text>
              </View>
            ) : null}

            {host ? (
              <Pressable
                onPress={() => setProfileUser(host)}
                style={[styles.hostCard, { backgroundColor: p.card, borderColor: p.separator }]}>
                <OwnerPetBadge user={host} pet={hostPet} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.hostName, { color: p.text }]}>
                    Hosted by {host.displayName}
                  </Text>
                  <Text style={[styles.hostMeta, { color: p.textSecondary }]}>
                    {hostedCount} event{hostedCount === 1 ? '' : 's'} hosted
                  </Text>
                </View>
                <Icon sf="chevron.right" size={13} color={p.textSecondary} />
              </Pressable>
            ) : null}

            <Text style={[styles.description, { color: p.text }]}>{event.description}</Text>

            <AttendeeStrip title="Going" userIds={going} onTapUser={setProfileUser} />
            <AttendeeStrip title="Interested" userIds={interested} onTapUser={setProfileUser} />

            {sbEvent ? (
              <SupabaseCommentsSection event={event} />
            ) : (
              <CommentsSection event={event} />
            )}
          </View>
        </ScrollView>

        {sbEvent ? <SupabaseRsvpBar event={event} /> : <RsvpBar event={event} />}
      </KeyboardAvoidingView>

      <Pressable
        onPress={() => router.back()}
        accessibilityLabel="Back"
        style={[styles.backBtn, { top: insets.top + 6 }]}>
        <Glass style={styles.backGlass}>
          <Icon sf="chevron.left" size={17} color={p.text} />
        </Glass>
      </Pressable>

      {profileUser ? (
        <Pressable style={styles.profileScrim} onPress={() => setProfileUser(null)}>
          <Pressable
            style={[styles.profileCard, { backgroundColor: p.card }]}
            onPress={() => {}}>
            <OwnerPetBadge
              user={profileUser}
              pet={Object.values(store.pets).find((x) => x.ownerId === profileUser.id)}
              size={64}
            />
            <Text style={[styles.profileName, { color: p.text }]}>
              {profileUser.displayName}
            </Text>
            <Text style={[styles.profileArea, { color: p.textSecondary }]}>
              {profileUser.homeArea}
            </Text>
            {Object.values(store.pets)
              .filter((x) => x.ownerId === profileUser.id)
              .map((pet) => (
                <Text key={pet.id} style={[styles.profilePet, { color: p.textSecondary }]}>
                  🐾 {pet.name} · {pet.breed}
                </Text>
              ))}
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { width: '100%', aspectRatio: 16 / 10 },
  heroChips: {
    position: 'absolute',
    left: Spacing.three,
    bottom: Spacing.three,
    flexDirection: 'row',
    gap: 6,
  },
  content: { padding: Spacing.three, gap: Spacing.three },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.md,
  },
  bannerText: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '800', fontFamily: Fonts?.rounded },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoText: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  privacyNote: { fontSize: 12, marginTop: 2 },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hostName: { fontSize: 15, fontWeight: '700' },
  hostMeta: { fontSize: 12 },
  description: { fontSize: 15, lineHeight: 22 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  strip: { flexDirection: 'row', gap: Spacing.three },
  stripItem: { alignItems: 'center', gap: 3, width: 62 },
  stripName: { fontSize: 11, fontWeight: '600' },
  rsvpBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  rsvpBtn: { flex: 1, justifyContent: 'center', paddingVertical: 14 },
  hostBarText: { flex: 1, gap: 1 },
  rsvpState: { fontSize: 15, fontWeight: '800', fontFamily: Fonts?.rounded },
  rsvpSub: { fontSize: 12, fontWeight: '600' },
  backBtn: { position: 'absolute', left: Spacing.three },
  backGlass: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFav: { position: 'absolute', right: Spacing.three, bottom: Spacing.three },
  heroFavGlass: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    width: '78%',
    borderRadius: Radii.xl,
    padding: Spacing.four,
    alignItems: 'center',
    gap: 6,
  },
  profileName: { fontSize: 20, fontWeight: '800', fontFamily: Fonts?.rounded },
  profileArea: { fontSize: 13 },
  profilePet: { fontSize: 14, fontWeight: '600' },
});
