import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { BottomTabInset, Fonts, Radii, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { BREEDS } from '@/lib/breeds';
import { at } from '@/lib/dates';
import { offsetMi } from '@/lib/geo';
import { searchAddresses, type AddressHit } from '@/lib/places';
import { pickImage, uploadPublicImage } from '@/lib/storage';
import { useCreateEvent, useUpdateEvent } from '@/lib/use-events';
import { notifyEventAttendees } from '@/lib/use-notifications';
import { useStore } from '@/lib/store';
import {
  RECURRENCE_LABELS,
  VENUE_ICONS,
  VENUE_LABELS,
  type EventRecurrence,
  type VenueType,
} from '@/lib/types';

const COVER_OPTIONS = [60, 61, 62, 63, 64, 65].map(
  (id) => `https://placedog.net/800/500?id=${id}`,
);
const DURATIONS = [1, 1.5, 2, 3, 4];
const VENUES = Object.keys(VENUE_LABELS) as VenueType[];
const RECURRENCES = Object.keys(RECURRENCE_LABELS) as EventRecurrence[];
const STEPS = ['Basics', 'When', 'Where', 'Who', 'Review'] as const;

interface FormState {
  title: string;
  description: string;
  coverPhotoUrl: string;
  start: Date;
  durH: number;
  venueType: VenueType;
  address: string;
  useMyLocation: boolean;
  breedFocus: string | null;
  capacity: string;
  rsvpMode: 'open' | 'host_approves';
  recurrence: EventRecurrence | null;
  // Real coords from a picked address suggestion (else the pin falls back to the area center).
  lat?: number;
  lng?: number;
}

function freshForm(): FormState {
  return {
    title: '',
    description: '',
    coverPhotoUrl: COVER_OPTIONS[0],
    start: at(3, 10),
    durH: 2,
    venueType: 'public_park',
    address: '',
    useMyLocation: true,
    breedFocus: null,
    capacity: '',
    rsvpMode: 'open',
    recurrence: null,
  };
}

export default function PostScreen() {
  const p = usePalette();
  const router = useRouter();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(freshForm);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addrHits, setAddrHits] = useState<AddressHit[]>([]);

  // Address autocomplete (debounced): search unless using my area or already picked.
  useEffect(() => {
    if (form.useMyLocation || form.lat != null || form.address.trim().length < 3) {
      setAddrHits([]);
      return;
    }
    const q = form.address;
    const t = setTimeout(async () => {
      try {
        setAddrHits(await searchAddresses(q));
      } catch {
        setAddrHits([]);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [form.address, form.useMyLocation, form.lat]);

  const pickCover = async () => {
    const uri = await pickImage();
    if (!uri) return;
    setUploadingCover(true);
    try {
      const url = await uploadPublicImage('events', uri);
      setForm((f) => ({ ...f, coverPhotoUrl: url }));
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setUploadingCover(false);
    }
  };

  // Edit ("edit this event") and "Host it again" both hand off through the store.
  useFocusEffect(
    useCallback(() => {
      const { editEvent, draft } = useStore.getState();
      if (editEvent) {
        const start = new Date(editEvent.startsAt);
        const durH = Math.max(
          0.5,
          (new Date(editEvent.endsAt).getTime() - start.getTime()) / 3600000,
        );
        setForm({
          title: editEvent.title,
          description: editEvent.description,
          coverPhotoUrl: editEvent.coverPhotoUrl,
          start,
          durH,
          venueType: editEvent.venueType,
          address: editEvent.address,
          useMyLocation: false,
          breedFocus: editEvent.breedFocus ?? null,
          capacity: editEvent.capacity != null ? String(editEvent.capacity) : '',
          rsvpMode: editEvent.rsvpMode === 'host_approves' ? 'host_approves' : 'open',
          recurrence: editEvent.recurrence ?? null,
          lat: editEvent.lat,
          lng: editEvent.lng,
        });
        setEditingId(editEvent.id);
        setStep(0);
        useStore.getState().setEditEvent(null);
        return;
      }
      if (draft) {
        setForm((f) => ({
          ...freshForm(),
          title: draft.title ?? f.title,
          description: draft.description ?? '',
          coverPhotoUrl: draft.coverPhotoUrl ?? COVER_OPTIONS[0],
          venueType: draft.venueType ?? 'public_park',
          address: draft.address ?? '',
          useMyLocation: false,
          breedFocus: draft.breedFocus ?? null,
          capacity: draft.capacity != null ? String(draft.capacity) : '',
          rsvpMode: draft.rsvpMode ?? 'open',
          recurrence: draft.recurrence ?? null,
        }));
        setStep(0);
        useStore.getState().setDraft(null);
      }
    }, []),
  );

  const upd = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const setVenue = (v: VenueType) => {
    // Backyard events default to host approval, per the safety spec.
    upd({
      venueType: v,
      rsvpMode: v === 'home_backyard' ? 'host_approves' : form.rsvpMode,
    });
  };

  const stepValid = (): string | null => {
    switch (step) {
      case 0:
        return form.title.trim() ? null : 'Give your event a title.';
      case 1:
        return form.start.getTime() > Date.now() ? null : 'Pick a time in the future.';
      case 2:
        return form.useMyLocation || form.address.trim()
          ? null
          : 'Enter an address or use your location.';
      default:
        return null;
    }
  };

  const next = () => {
    const err = stepValid();
    if (err) {
      Alert.alert(err);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const publish = async () => {
    const s = useStore.getState();
    // Coords: a picked/edited address wins; otherwise drop the pin near the area center.
    const jitter = () => (Math.random() - 0.5) * 2;
    const loc =
      !form.useMyLocation && form.lat != null && form.lng != null
        ? { lat: form.lat, lng: form.lng }
        : offsetMi(s.center, jitter() * (form.useMyLocation ? 0.5 : 2), jitter() * (form.useMyLocation ? 0.5 : 2));
    const end = new Date(form.start.getTime() + form.durH * 3600 * 1000);
    const capacity = parseInt(form.capacity, 10);
    const fields = {
      title: form.title.trim(),
      description: form.description.trim() || 'See you there! 🐾',
      coverPhotoUrl: form.coverPhotoUrl,
      startsAt: form.start.toISOString(),
      endsAt: end.toISOString(),
      venueType: form.venueType,
      address: form.address.trim() || 'Near your area',
      areaLabel:
        form.venueType === 'home_backyard' ? 'Near you' : form.address.trim() || 'Near you',
      breedFocus: form.breedFocus ?? undefined,
      capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : undefined,
      rsvpMode: form.rsvpMode,
      recurrence: form.recurrence ?? undefined,
    };
    try {
      if (editingId) {
        // Keeps the original pin unless a new address was picked (form.lat/lng).
        await updateEvent.mutateAsync({
          id: editingId,
          patch: { ...fields, lat: loc.lat, lng: loc.lng },
        });
        // Let attendees know via in-app notification (best-effort).
        await notifyEventAttendees(
          editingId,
          'event_updated',
          `${fields.title} was updated — check the latest details.`,
        ).catch(() => {});
        const id = editingId;
        setEditingId(null);
        setForm(freshForm());
        setStep(0);
        router.push(`/event/${id}`);
        return;
      }
      const id = await createEvent.mutateAsync({ ...fields, lat: loc.lat, lng: loc.lng });
      setForm(freshForm());
      setStep(0);
      router.push(`/event/${id}`);
    } catch (e) {
      Alert.alert('Couldn’t publish', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const input = (extra?: object) => [
    styles.input,
    { color: p.text, backgroundColor: p.card, borderColor: p.separator },
    extra,
  ];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p.background }]} edges={['top']}>
      <Text style={[styles.title, { color: p.text }]}>
        {editingId ? 'Edit event' : 'Host an event'}
      </Text>

      <View style={styles.progress}>
        {STEPS.map((label, i) => (
          <Pressable key={label} onPress={() => i < step && setStep(i)} style={styles.progressItem}>
            <View
              style={[
                styles.dot,
                { backgroundColor: i <= step ? p.accent : p.chipBg },
              ]}
            />
            <Text
              style={[
                styles.progressLabel,
                { color: i === step ? p.text : p.textSecondary },
              ]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: BottomTabInset + 90 }]}
          keyboardShouldPersistTaps="handled">
          {step === 0 ? (
            <View style={styles.stepWrap}>
              <Text style={[styles.label, { color: p.textSecondary }]}>TITLE</Text>
              <TextInput
                value={form.title}
                onChangeText={(t) => upd({ title: t })}
                placeholder="Golden Retriever Meetup at the Park"
                placeholderTextColor={p.textSecondary}
                style={input()}
              />
              <Text style={[styles.label, { color: p.textSecondary }]}>DESCRIPTION</Text>
              <TextInput
                value={form.description}
                onChangeText={(t) => upd({ description: t })}
                placeholder="What should people (and dogs) expect?"
                placeholderTextColor={p.textSecondary}
                multiline
                style={input({ minHeight: 110, textAlignVertical: 'top' })}
              />
              <Text style={[styles.label, { color: p.textSecondary }]}>COVER PHOTO</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.coverRow}>
                  <Pressable
                    onPress={pickCover}
                    disabled={uploadingCover}
                    accessibilityRole="button"
                    accessibilityLabel="Upload a cover photo"
                    style={[styles.coverOption, styles.coverUpload, { borderColor: p.separator }]}>
                    {uploadingCover ? (
                      <ActivityIndicator color={p.accent} />
                    ) : (
                      <>
                        <Icon sf="photo.badge.plus" size={22} color={p.accent} />
                        <Text style={[styles.coverUploadText, { color: p.accent }]}>Upload</Text>
                      </>
                    )}
                  </Pressable>
                  {!COVER_OPTIONS.includes(form.coverPhotoUrl) ? (
                    <Image
                      source={{ uri: form.coverPhotoUrl }}
                      style={[styles.coverOption, { borderColor: p.accent, borderWidth: 3 }]}
                    />
                  ) : null}
                  {COVER_OPTIONS.map((uri) => (
                    <Pressable key={uri} onPress={() => upd({ coverPhotoUrl: uri })}>
                      <Image
                        source={{ uri }}
                        style={[
                          styles.coverOption,
                          form.coverPhotoUrl === uri && { borderColor: p.accent, borderWidth: 3 },
                        ]}
                      />
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.stepWrap}>
              <Text style={[styles.label, { color: p.textSecondary }]}>STARTS</Text>
              <View style={styles.pickerWrap}>
                <DateTimePicker
                  value={form.start}
                  mode="datetime"
                  minimumDate={new Date()}
                  onChange={(_, d) => d && upd({ start: d })}
                />
              </View>
              <Text style={[styles.label, { color: p.textSecondary }]}>DURATION</Text>
              <View style={styles.wrapRow}>
                {DURATIONS.map((d) => (
                  <Chip
                    key={d}
                    label={d === 1 ? '1 hour' : `${d} hours`}
                    selected={form.durH === d}
                    onPress={() => upd({ durH: d })}
                  />
                ))}
              </View>
              <Text style={[styles.label, { color: p.textSecondary }]}>REPEATS</Text>
              <View style={styles.wrapRow}>
                <Chip
                  label="One-time"
                  selected={form.recurrence === null}
                  onPress={() => upd({ recurrence: null })}
                />
                {RECURRENCES.map((r) => (
                  <Chip
                    key={r}
                    sf="repeat"
                    label={RECURRENCE_LABELS[r]}
                    selected={form.recurrence === r}
                    onPress={() => upd({ recurrence: r })}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.stepWrap}>
              <Text style={[styles.label, { color: p.textSecondary }]}>VENUE TYPE</Text>
              <View style={styles.wrapRow}>
                {VENUES.map((v) => (
                  <Chip
                    key={v}
                    label={VENUE_LABELS[v]}
                    sf={VENUE_ICONS[v]}
                    selected={form.venueType === v}
                    onPress={() => setVenue(v)}
                  />
                ))}
              </View>
              {form.venueType === 'home_backyard' ? (
                <View style={[styles.note, { backgroundColor: p.accentSoft }]}>
                  <Icon sf="lock.shield.fill" size={15} color={p.accent} />
                  <Text style={[styles.noteText, { color: p.text }]}>
                    Backyard events show an approximate location publicly. Your exact address is
                    only shared with people you approve.
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.label, { color: p.textSecondary }]}>ADDRESS / MEETING SPOT</Text>
              <TextInput
                value={form.address}
                onChangeText={(t) => upd({ address: t, lat: undefined, lng: undefined })}
                placeholder="Search a park, beach, or address…"
                placeholderTextColor={p.textSecondary}
                editable={!form.useMyLocation}
                style={[input(), form.useMyLocation && { opacity: 0.5 }]}
              />
              {!form.useMyLocation && form.lat != null ? (
                <Text style={[styles.hint, { color: p.success }]}>
                  ✓ Pinned to this location
                </Text>
              ) : null}
              {!form.useMyLocation && addrHits.length > 0 && form.lat == null ? (
                <View style={[styles.suggestions, { backgroundColor: p.card, borderColor: p.separator }]}>
                  {addrHits.map((h) => (
                    <Pressable
                      key={`${h.lat},${h.lng}`}
                      onPress={() => {
                        upd({ address: h.label, lat: h.lat, lng: h.lng });
                        setAddrHits([]);
                      }}
                      style={styles.suggestionRow}>
                      <Icon sf="mappin.circle.fill" size={16} color={p.accent} />
                      <Text style={[styles.suggestionText, { color: p.text }]} numberOfLines={2}>
                        {h.full}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: p.text }]}>
                  Pin near my current area
                </Text>
                <Switch
                  value={form.useMyLocation}
                  onValueChange={(v) => upd({ useMyLocation: v, lat: undefined, lng: undefined })}
                  trackColor={{ true: p.accent }}
                />
              </View>
              <Text style={[styles.hint, { color: p.textSecondary }]}>
                {form.useMyLocation
                  ? 'The map pin lands near your area center.'
                  : 'Search and pick a spot for an exact pin, or switch to your area.'}
              </Text>
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.stepWrap}>
              <Text style={[styles.label, { color: p.textSecondary }]}>BREED FOCUS (OPTIONAL)</Text>
              <View style={styles.wrapRow}>
                <Chip
                  label="All breeds"
                  selected={form.breedFocus === null}
                  onPress={() => upd({ breedFocus: null })}
                />
                {BREEDS.map((b) => (
                  <Chip
                    key={b}
                    label={b}
                    selected={form.breedFocus === b}
                    onPress={() => upd({ breedFocus: b })}
                  />
                ))}
              </View>
              <Text style={[styles.label, { color: p.textSecondary }]}>CAPACITY (OPTIONAL)</Text>
              <TextInput
                value={form.capacity}
                onChangeText={(t) => upd({ capacity: t.replace(/[^0-9]/g, '') })}
                placeholder="No limit"
                placeholderTextColor={p.textSecondary}
                keyboardType="number-pad"
                style={input({ width: 140 })}
              />
              <Text style={[styles.label, { color: p.textSecondary }]}>WHO CAN JOIN</Text>
              <View style={styles.wrapRow}>
                <Chip
                  label="Open — anyone can RSVP"
                  selected={form.rsvpMode === 'open'}
                  onPress={() => upd({ rsvpMode: 'open' })}
                />
                <Chip
                  label="I approve requests"
                  selected={form.rsvpMode === 'host_approves'}
                  onPress={() => upd({ rsvpMode: 'host_approves' })}
                />
              </View>
              {form.venueType === 'home_backyard' && form.rsvpMode === 'open' ? (
                <Text style={[styles.hint, { color: p.danger }]}>
                  Recommended: approve requests for events at your home.
                </Text>
              ) : null}
            </View>
          ) : null}

          {step === 4 ? (
            <View style={styles.stepWrap}>
              <Image source={{ uri: form.coverPhotoUrl }} style={styles.reviewCover} />
              <Text style={[styles.reviewTitle, { color: p.text }]}>{form.title || 'Untitled'}</Text>
              <ReviewRow
                sf="calendar"
                text={`${form.start.toLocaleString()} · ${form.durH}h${
                  form.recurrence ? ` · repeats ${RECURRENCE_LABELS[form.recurrence].toLowerCase()}` : ''
                }`}
              />
              <ReviewRow
                sf={VENUE_ICONS[form.venueType]}
                text={`${VENUE_LABELS[form.venueType]} — ${form.address || 'near your area'}`}
              />
              <ReviewRow
                sf="pawprint.fill"
                text={form.breedFocus ? `${form.breedFocus} focused` : 'All breeds welcome'}
              />
              <ReviewRow
                sf="person.2.fill"
                text={`${form.capacity ? `Capacity ${form.capacity}` : 'No capacity limit'} · ${
                  form.rsvpMode === 'open' ? 'open RSVP' : 'host approves'
                }`}
              />
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { bottom: BottomTabInset }]}>
          {step > 0 ? (
            <Chip label="Back" onPress={() => setStep((s) => s - 1)} style={styles.footerBtn} />
          ) : null}
          <Chip
            label={
              step === STEPS.length - 1 ? (editingId ? 'Save changes' : 'Publish 🎉') : 'Next'
            }
            selected
            onPress={step === STEPS.length - 1 ? publish : next}
            style={styles.footerBtn}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ReviewRow({ sf, text }: { sf: string; text: string }) {
  const p = usePalette();
  return (
    <View style={styles.reviewRow}>
      <Icon sf={sf} size={16} color={p.accent} />
      <Text style={[styles.reviewText, { color: p.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: {
    fontSize: 32,
    fontWeight: '800',
    fontFamily: Fonts?.rounded,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  progress: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  progressItem: { alignItems: 'center', gap: 3 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  progressLabel: { fontSize: 11, fontWeight: '700' },
  body: { padding: Spacing.three },
  stepWrap: { gap: Spacing.two },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginTop: Spacing.two },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.md,
    padding: 14,
    fontSize: 16,
  },
  coverRow: { flexDirection: 'row', gap: Spacing.two },
  coverOption: { width: 140, height: 88, borderRadius: Radii.md },
  coverUpload: {
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  coverUploadText: { fontSize: 12, fontWeight: '700' },
  pickerWrap: { alignItems: 'flex-start' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: {
    flexDirection: 'row',
    gap: 8,
    padding: Spacing.three,
    borderRadius: Radii.md,
    alignItems: 'flex-start',
  },
  noteText: { fontSize: 13, lineHeight: 18, flex: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  switchLabel: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 16 },
  suggestions: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestionText: { flex: 1, fontSize: 14 },
  reviewCover: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radii.lg },
  reviewTitle: { fontSize: 22, fontWeight: '800', fontFamily: Fonts?.rounded },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewText: { fontSize: 15, fontWeight: '600', flex: 1 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  footerBtn: { flex: 1, justifyContent: 'center', paddingVertical: 14 },
});
