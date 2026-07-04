import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { EventRow } from '@/components/event-row';
import { Icon } from '@/components/icon';
import { BottomTabInset, Fonts, Radii, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { BREEDS } from '@/lib/breeds';
import {
  hostedEvents,
  myFavoriteEvents,
  myPastEvents,
  myPets,
  myRsvp,
  myUpcomingEvents,
} from '@/lib/selectors';
import { useStore } from '@/lib/store';
import type { Pet, PetSize } from '@/lib/types';

interface PetForm {
  petId?: string;
  name: string;
  breed: string;
  size: PetSize;
}

// LayoutAnimation needs a one-time opt-in on Android; a no-op on iOS.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** A profile section whose body collapses/expands when the header is tapped. */
function Section({
  title,
  collapsed,
  onToggle,
  right,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const p = usePalette();
  return (
    <View style={styles.section}>
      <Pressable onPress={onToggle} style={styles.sectionHeader} accessibilityRole="button">
        <View style={styles.sectionHeaderLeft}>
          <Icon
            sf={collapsed ? 'chevron.right' : 'chevron.down'}
            size={11}
            color={p.textSecondary}
          />
          <Text style={[styles.sectionLabel, { color: p.textSecondary }]}>{title}</Text>
        </View>
        {right}
      </Pressable>
      {collapsed ? null : children}
    </View>
  );
}

export default function ProfileScreen() {
  const p = usePalette();
  const router = useRouter();
  const store = useStore();
  const me = store.users[store.currentUserId];
  const pets = myPets(store);
  const upcoming = myUpcomingEvents(store);
  const hostedActive = hostedEvents(store, 'active');
  const saved = myFavoriteEvents(store);
  const past = myPastEvents(store);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [petForm, setPetForm] = useState<PetForm | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  };

  if (!me) return null;

  const attendedPast = past.filter((e) => e.hostId !== me.id).length;
  const hostedTotal = Object.values(store.events).filter((e) => e.hostId === me.id).length;
  const rsvpTotal = store.rsvps.filter(
    (r) => r.userId === me.id && r.status === 'going',
  ).length;

  const achievements = [
    { sf: 'pawprint.fill', label: 'First Meetup', earned: attendedPast >= 1 },
    { sf: 'house.fill', label: 'Host', earned: hostedTotal >= 1 },
    { sf: 'star.fill', label: '5 Events', earned: rsvpTotal >= 5 },
    {
      sf: 'crown.fill',
      label: 'Breed Ambassador',
      earned: Object.values(store.events).some(
        (e) => e.hostId === me.id && e.breedFocus,
      ),
    },
  ];

  const savePet = () => {
    if (!petForm) return;
    const name = petForm.name.trim();
    if (!name) {
      Alert.alert('Give your pet a name');
      return;
    }
    if (petForm.petId) {
      store.updatePet(petForm.petId, {
        name,
        breed: petForm.breed,
        size: petForm.size,
      });
    } else {
      store.addPet(name, petForm.breed, petForm.size);
    }
    setPetForm(null);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: BottomTabInset + Spacing.four }]}>
        <View style={styles.meRow}>
          <Image source={{ uri: me.avatarUrl }} style={styles.meAvatar} />
          <View style={{ flex: 1 }}>
            <Pressable
              style={styles.nameRow}
              onPress={() => {
                setNameDraft(me.displayName);
                setEditingName(true);
              }}>
              <Text style={[styles.meName, { color: p.text }]}>{me.displayName}</Text>
              <Icon sf="pencil" size={15} color={p.textSecondary} />
            </Pressable>
            <Text style={[styles.meArea, { color: p.textSecondary }]}>
              {store.centerLabel}
            </Text>
          </View>
        </View>

        <View style={styles.badgeRow}>
          {achievements.map((a) => (
            <View
              key={a.label}
              style={[
                styles.badge,
                { backgroundColor: a.earned ? p.accentSoft : p.chipBg, opacity: a.earned ? 1 : 0.45 },
              ]}>
              <Icon sf={a.sf} size={18} color={a.earned ? p.accent : p.textSecondary} />
              <Text
                style={[
                  styles.badgeLabel,
                  { color: a.earned ? p.text : p.textSecondary },
                ]}>
                {a.label}
              </Text>
            </View>
          ))}
        </View>

        <Section
          title="MY PETS"
          collapsed={!!collapsed.pets}
          onToggle={() => toggleSection('pets')}
          right={
            <Chip
              small
              label="Add pet"
              onPress={() => setPetForm({ name: '', breed: BREEDS[0], size: 'M' })}
            />
          }>
          {pets.map((pet: Pet) => (
            <Pressable
              key={pet.id}
              onPress={() =>
                setPetForm({ petId: pet.id, name: pet.name, breed: pet.breed, size: pet.size })
              }
              style={[styles.petRow, { backgroundColor: p.card, borderColor: p.separator }]}>
              <Image source={{ uri: pet.photoUrl }} style={styles.petPhoto} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.petName, { color: p.text }]}>{pet.name}</Text>
                <Text style={[styles.petMeta, { color: p.textSecondary }]}>
                  {pet.breed} · size {pet.size}
                </Text>
              </View>
              <Icon sf="pencil" size={14} color={p.textSecondary} />
            </Pressable>
          ))}
        </Section>

        {upcoming.length > 0 ? (
          <Section
            title="UPCOMING"
            collapsed={!!collapsed.upcoming}
            onToggle={() => toggleSection('upcoming')}>
            {upcoming.map(({ event, rsvp }) => (
              <EventRow key={event.id} event={event} rsvpStatus={rsvp.status} />
            ))}
          </Section>
        ) : null}

        {hostedActive.length > 0 ? (
          <Section
            title="HOSTING"
            collapsed={!!collapsed.hosting}
            onToggle={() => toggleSection('hosting')}>
            {hostedActive.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </Section>
        ) : null}

        {saved.length > 0 ? (
          <Section
            title="SAVED"
            collapsed={!!collapsed.saved}
            onToggle={() => toggleSection('saved')}>
            {saved.map((event) => (
              <EventRow key={event.id} event={event} rsvpStatus={myRsvp(store, event.id)?.status} />
            ))}
          </Section>
        ) : null}

        {past.length > 0 ? (
          <Section
            title="PAST"
            collapsed={!!collapsed.past}
            onToggle={() => toggleSection('past')}>
            {past.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                rsvpStatus={myRsvp(store, event.id)?.status}
                right={
                  event.hostId === me.id ? (
                    <Chip
                      small
                      label="Host again"
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
                  ) : undefined
                }
              />
            ))}
          </Section>
        ) : null}

        <Pressable
          onPress={() =>
            Alert.alert(
              'Reset demo data?',
              'Regenerates all mock events, people, and comments around your current area. Your name and pets are kept.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Reset',
                  style: 'destructive',
                  onPress: () => store.reseed(store.center, store.centerLabel),
                },
              ],
            )
          }>
          <Text style={[styles.reset, { color: p.danger }]}>Reset demo data</Text>
        </Pressable>
        <Text style={[styles.buildNote, { color: p.textSecondary }]}>
          Pawk v1 demo — all data is local & mock. No backend yet.
        </Text>
      </ScrollView>

      <Modal
        visible={editingName}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingName(false)}>
        <Pressable style={styles.scrim} onPress={() => setEditingName(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: p.card }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: p.text }]}>Your name</Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              autoFocus
              style={[styles.modalInput, { color: p.text, borderColor: p.separator }]}
            />
            <View style={styles.modalActions}>
              <Chip label="Cancel" onPress={() => setEditingName(false)} />
              <Chip
                label="Save"
                selected
                onPress={() => {
                  const t = nameDraft.trim();
                  if (t) store.updateProfile(t);
                  setEditingName(false);
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={petForm !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPetForm(null)}>
        <Pressable style={styles.scrim} onPress={() => setPetForm(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: p.card }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: p.text }]}>
              {petForm?.petId ? 'Edit pet' : 'Add a pet'}
            </Text>
            <TextInput
              value={petForm?.name ?? ''}
              onChangeText={(t) => setPetForm((f) => (f ? { ...f, name: t } : f))}
              placeholder="Name"
              placeholderTextColor={p.textSecondary}
              style={[styles.modalInput, { color: p.text, borderColor: p.separator }]}
            />
            <ScrollView style={{ maxHeight: 170 }}>
              <View style={styles.breedWrap}>
                {BREEDS.map((b) => (
                  <Chip
                    key={b}
                    small
                    label={b}
                    selected={petForm?.breed === b}
                    onPress={() => setPetForm((f) => (f ? { ...f, breed: b } : f))}
                  />
                ))}
              </View>
            </ScrollView>
            <View style={styles.sizeRow}>
              {(['S', 'M', 'L'] as PetSize[]).map((s) => (
                <Chip
                  key={s}
                  small
                  label={s}
                  selected={petForm?.size === s}
                  onPress={() => setPetForm((f) => (f ? { ...f, size: s } : f))}
                />
              ))}
            </View>
            <View style={styles.modalActions}>
              <Chip label="Cancel" onPress={() => setPetForm(null)} />
              <Chip label="Save" selected onPress={savePet} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: Spacing.three, gap: Spacing.four },
  meRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  meAvatar: { width: 72, height: 72, borderRadius: 36 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meName: { fontSize: 26, fontWeight: '800', fontFamily: Fonts?.rounded },
  meArea: { fontSize: 14 },
  badgeRow: { flexDirection: 'row', gap: Spacing.two },
  badge: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.two,
    borderRadius: Radii.md,
  },
  badgeLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  section: { gap: Spacing.two },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  petPhoto: { width: 52, height: 52, borderRadius: 26 },
  petName: { fontSize: 16, fontWeight: '700' },
  petMeta: { fontSize: 13 },
  reset: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  buildNote: { fontSize: 11, textAlign: 'center' },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    width: '100%',
    borderRadius: Radii.xl,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', fontFamily: Fonts?.rounded },
  modalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.sm,
    padding: 12,
    fontSize: 16,
  },
  breedWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sizeRow: { flexDirection: 'row', gap: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
