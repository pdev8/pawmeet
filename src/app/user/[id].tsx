import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { Glass } from '@/components/glass';
import { Icon } from '@/components/icon';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { useBlockActions, useBlockedIds } from '@/lib/use-blocks';
import { useReportContent } from '@/lib/use-reports';
import { useCurrentUserId } from '@/lib/use-rsvps';
import { useUserProfile } from '@/lib/use-user-profile';
import type { PetSize } from '@/lib/types';

const SIZE_LABELS: Record<PetSize, string> = { S: 'Small', M: 'Medium', L: 'Large' };

export default function UserProfileScreen() {
  const p = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: profile, isLoading } = useUserProfile(id);
  const { data: myId } = useCurrentUserId();
  const { data: blockedIds = [] } = useBlockedIds();
  const report = useReportContent();
  const blocks = useBlockActions();

  const isMe = !!myId && myId === id;
  const isBlocked = blockedIds.includes(id ?? '');
  const name = profile?.displayName ?? 'Profile';

  const onReport = () =>
    Alert.alert(`Report ${name}?`, 'Our team will review this account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: () =>
          report.mutate(
            { targetType: 'user', targetId: id },
            {
              onSuccess: () => Alert.alert('Thanks for the report', 'We’ll take a look.'),
              onError: (e) => Alert.alert('Could not report', (e as Error).message),
            },
          ),
      },
    ]);

  const onBlock = () =>
    Alert.alert(`Block ${name}?`, 'You won’t see their events, RSVPs, or comments, and they won’t see yours.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => blocks.block.mutate(id, { onSuccess: () => router.back() }),
      },
    ]);

  return (
    <View style={[styles.screen, { backgroundColor: p.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 52 }]}>
      {isLoading ? (
        <Text style={[styles.muted, { color: p.textSecondary }]}>Loading…</Text>
      ) : !profile ? (
        <EmptyState sf="person.slash" title="Profile not found" subtitle="This account may have been deleted." />
      ) : (
        <>
          <View style={styles.header}>
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} accessibilityLabel={profile.displayName} />
            <Text style={[styles.name, { color: p.text }]}>{profile.displayName}</Text>
            {profile.homeArea ? (
              <Text style={[styles.area, { color: p.textSecondary }]}>{profile.homeArea}</Text>
            ) : null}
          </View>

          <Text style={[styles.sectionLabel, { color: p.textSecondary }]}>
            {profile.pets.length > 0 ? 'PETS' : 'NO PETS YET'}
          </Text>
          {profile.pets.map((pet) => (
            <View key={pet.id} style={[styles.petCard, { backgroundColor: p.card, borderColor: p.separator }]}>
              <Image source={{ uri: pet.photoUrl }} style={styles.petPhoto} accessibilityLabel={pet.name} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.petName, { color: p.text }]}>{pet.name}</Text>
                <Text style={[styles.petMeta, { color: p.textSecondary }]}>
                  {pet.breed} · {SIZE_LABELS[pet.size]}
                </Text>
                {pet.temperament.length > 0 ? (
                  <View style={styles.tags}>
                    {pet.temperament.map((t) => (
                      <View key={t} style={[styles.tag, { backgroundColor: p.chipBg }]}>
                        <Text style={[styles.tagText, { color: p.textSecondary }]}>{t}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ))}

          {!isMe ? (
            <View style={styles.actions}>
              {isBlocked ? (
                <Chip label="Unblock" onPress={() => blocks.unblock.mutate(id)} />
              ) : (
                <Chip label="Block" onPress={onBlock} />
              )}
              <Pressable onPress={onReport} hitSlop={8} style={styles.reportBtn}>
                <Text style={[styles.reportText, { color: p.textSecondary }]}>Report user</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}
      </ScrollView>

      <Pressable
        onPress={() => router.back()}
        accessibilityLabel="Back"
        style={[styles.backBtn, { top: insets.top + 6 }]}>
        <Glass style={styles.backGlass}>
          <Icon sf="chevron.left" size={17} color={p.text} />
        </Glass>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: Spacing.four, gap: Spacing.three },
  backBtn: { position: 'absolute', left: Spacing.three },
  backGlass: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  muted: { fontSize: 14, textAlign: 'center', marginTop: Spacing.five },
  header: { alignItems: 'center', gap: 6, marginBottom: Spacing.two },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  name: { fontSize: 24, fontWeight: '800', fontFamily: Fonts?.rounded },
  area: { fontSize: 14, fontWeight: '600' },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  petCard: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  petPhoto: { width: 56, height: 56, borderRadius: 28 },
  petName: { fontSize: 16, fontWeight: '700' },
  petMeta: { fontSize: 13, marginTop: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontSize: 11, fontWeight: '700' },
  actions: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.three },
  reportBtn: { paddingVertical: Spacing.two },
  reportText: { fontSize: 13, fontWeight: '700' },
});
