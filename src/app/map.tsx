import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polygon, Polyline, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { Glass } from '@/components/glass';
import { Icon } from '@/components/icon';
import { PawkLogo } from '@/components/logo';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { crosshatch } from '@/lib/hatch';
import {
  CATEGORY_LABELS,
  demoReviews,
  fetchDogFriendlyPlaces,
  geocodeLocation,
  placeRating,
  type DogPlace,
  type PlaceCategory,
} from '@/lib/places';
import {
  useAddPlaceReview,
  useDeletePlaceReview,
  usePlaceReviews,
  useUpdatePlaceReview,
} from '@/lib/use-place-reviews';
import { blendedRating, mergeReviews, stars } from '@/lib/reviews';
import { DEFAULT_FILTERS } from '@/lib/filters';
import { useDiscoverEvents } from '@/lib/use-events';
import { useCurrentUserId } from '@/lib/use-rsvps';
import { useStore } from '@/lib/store';

// One distinct hue per category so a filter chip visually matches the areas it
// toggles: green dog parks, teal parks, olive nature reserves, blue beaches,
// orange trails. fill/stroke/hatch are all derived from the same base color.
const CATEGORY_COLORS = {
  dog_park: { fill: 'rgba(22,163,74,0.22)', stroke: '#16A34A', hatch: 'rgba(22,163,74,0.60)' },
  park: { fill: 'rgba(13,148,136,0.18)', stroke: '#0D9488', hatch: 'rgba(13,148,136,0.55)' },
  nature_reserve: {
    fill: 'rgba(77,124,15,0.18)',
    stroke: '#4D7C0F',
    hatch: 'rgba(77,124,15,0.55)',
  },
  beach: { fill: 'rgba(37,99,235,0.16)', stroke: '#2563EB', hatch: 'rgba(37,99,235,0.55)' },
  trail: { fill: '', stroke: '#C2410C', hatch: '' },
} as const;

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as PlaceCategory[];
// Hatching every polygon gets heavy; hatch the most important ones and
// render the rest with fill + outline only.
const MAX_HATCHED = 22;
// The biggest areas (plus every dog park) get a Pawk pin for legibility.
const MAX_LOGO_PINS = 8;

export default function MapScreen() {
  const p = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region | null>(null);

  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<DogPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Filter selections persist across sessions (store), initialised on mount.
  const [enabled, setEnabled] = useState<Set<PlaceCategory>>(
    () => new Set(useStore.getState().mapCategories as PlaceCategory[]),
  );
  const [showEvents, setShowEvents] = useState(() => useStore.getState().mapShowEvents);
  const [legendOpen, setLegendOpen] = useState(false);
  // Upcoming events near the area, shown as pins (wide radius so the map is well populated).
  const eventFilters = useMemo(() => ({ ...DEFAULT_FILTERS, radiusMi: 50 }), []);
  const { data: eventItems = [] } = useDiscoverEvents(store.center, eventFilters);
  const [selected, setSelected] = useState<DogPlace | null>(null);
  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const initialRegion: Region = {
    latitude: store.center.lat,
    longitude: store.center.lng,
    latitudeDelta: 0.055,
    longitudeDelta: 0.055,
  };

  const load = async (lat: number, lng: number) => {
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      setPlaces(await fetchDogFriendlyPlaces({ lat, lng }));
    } catch {
      setError('Could not load places — try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(store.center.lat, store.center.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset the review composer whenever the selected place changes or closes.
  useEffect(() => {
    setMyRating(0);
    setMyText('');
    setEditingId(null);
  }, [selected?.id]);

  const onSearch = async () => {
    const q = query.trim();
    if (!q) return;
    Keyboard.dismiss();
    setLoading(true);
    const hit = await geocodeLocation(q).catch(() => null);
    if (!hit) {
      setLoading(false);
      setError(`Couldn't find "${q}"`);
      return;
    }
    mapRef.current?.animateToRegion(
      { latitude: hit.lat, longitude: hit.lng, latitudeDelta: 0.055, longitudeDelta: 0.055 },
      600,
    );
    load(hit.lat, hit.lng);
  };

  const searchThisArea = () => {
    const r = regionRef.current;
    if (r) load(r.latitude, r.longitude);
  };

  const visible = useMemo(
    () => places.filter((pl) => enabled.has(pl.category)),
    [places, enabled],
  );

  // Precompute hatch segments once per fetch, not per render.
  const hatches = useMemo(() => {
    const out = new Map<string, ReturnType<typeof crosshatch>>();
    let hatched = 0;
    for (const pl of places) {
      if (!pl.ring) continue;
      if (hatched >= MAX_HATCHED && pl.category !== 'dog_park') continue;
      out.set(pl.id, crosshatch(pl.ring));
      hatched++;
    }
    return out;
  }, [places]);

  // Pawk pins: every dog park + the largest few areas.
  const pinnedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const pl of places) if (pl.category === 'dog_park') ids.add(pl.id);
    const biggest = places
      .filter((pl) => pl.ring && pl.category !== 'dog_park')
      .sort((a, b) => b.areaM2 - a.areaM2)
      .slice(0, MAX_LOGO_PINS);
    for (const pl of biggest) ids.add(pl.id);
    return ids;
  }, [places]);

  const reviewers = useMemo(
    () =>
      Object.values(store.users).filter((u) => u.id !== store.currentUserId),
    [store.users, store.currentUserId],
  );

  const toggle = (c: PlaceCategory) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      store.setMapCategories([...next]);
      return next;
    });

  const toggleEvents = () =>
    setShowEvents((v) => {
      store.setMapShowEvents(!v);
      return !v;
    });

  // My own reviews (persisted) show first, then the demo community reviews.
  // The headline rating blends both so a place reacts to what I leave.
  // My reviews (newest first, flagged for edit/delete) above the demo community
  // reviews; the headline rating blends both. See src/lib/reviews.ts.
  const { data: community = [] } = usePlaceReviews(selected?.id);
  const { data: myId } = useCurrentUserId();
  const addReview = useAddPlaceReview();
  const updateReview = useUpdatePlaceReview();
  const deleteReviewMut = useDeletePlaceReview();
  const demoList = selected ? demoReviews(selected, reviewers) : [];
  const reviews = selected ? mergeReviews(community, demoList, myId) : [];
  const rating = selected ? blendedRating(placeRating(selected), demoList.length, community) : 0;
  const reviewCount = demoList.length + community.length;

  const canReview = myRating >= 1 && myText.trim().length > 0;

  const resetComposer = () => {
    setMyRating(0);
    setMyText('');
    setEditingId(null);
  };

  const submitReview = () => {
    if (!selected || !canReview) return;
    if (editingId) {
      updateReview.mutate({ id: editingId, rating: myRating, text: myText });
    } else {
      addReview.mutate({ placeId: selected.id, rating: myRating, text: myText });
    }
    resetComposer();
    Keyboard.dismiss();
  };

  const editReview = (reviewId: string) => {
    const r = community.find((x) => x.id === reviewId);
    if (!r) return;
    setEditingId(reviewId);
    setMyRating(r.rating);
    setMyText(r.text);
  };

  const deleteReview = (reviewId: string) => {
    Alert.alert('Delete your review?', 'This removes your review for this place.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteReviewMut.mutate(reviewId);
          if (editingId === reviewId) resetComposer();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation
        onPress={() => setSelected(null)}
        onRegionChangeComplete={(r) => (regionRef.current = r)}>
        {visible.map((pl) => {
          const colors = CATEGORY_COLORS[pl.category];
          if (pl.line) {
            return (
              <Polyline
                key={pl.id}
                coordinates={pl.line}
                strokeColor={colors.stroke}
                strokeWidth={3}
                lineDashPattern={[10, 6]}
                tappable
                onPress={() => setSelected(pl)}
              />
            );
          }
          if (!pl.ring) return null;
          return (
            <Fragment key={pl.id}>
              <Polygon
                coordinates={pl.ring}
                fillColor={colors.fill}
                strokeColor={colors.stroke}
                strokeWidth={selected?.id === pl.id ? 3 : 1.5}
                tappable
                onPress={() => setSelected(pl)}
              />
              {(hatches.get(pl.id) ?? []).map((seg, i) => (
                <Polyline
                  key={`${pl.id}-h${i}`}
                  coordinates={seg}
                  strokeColor={colors.hatch}
                  strokeWidth={1.2}
                />
              ))}
            </Fragment>
          );
        })}
        {visible
          .filter((pl) => pinnedIds.has(pl.id))
          .map((pl) => (
            <Marker
              key={`m-${pl.id}`}
              coordinate={pl.center}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={(e) => {
                e.stopPropagation();
                setSelected(pl);
              }}>
              <View
                style={[
                  styles.logoPin,
                  { backgroundColor: p.card, borderColor: CATEGORY_COLORS[pl.category].stroke },
                ]}>
                <PawkLogo size={22} animated={false} />
              </View>
            </Marker>
          ))}
        {showEvents &&
          eventItems.map(({ event }) => (
            <Marker
              key={`ev-${event.id}`}
              coordinate={{ latitude: event.lat, longitude: event.lng }}
              anchor={{ x: 0.5, y: 1 }}
              onPress={(e) => {
                e.stopPropagation();
                router.push(`/event/${event.id}`);
              }}>
              <View style={[styles.eventPin, { backgroundColor: p.accent, borderColor: p.card }]}>
                <Icon sf="pawprint.fill" size={14} color={p.onAccent} />
              </View>
            </Marker>
          ))}
      </MapView>

      <View style={[styles.topBars, { top: insets.top + 6 }]}>
        <Glass style={styles.searchBar}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Close map">
            <Icon sf="chevron.left" size={18} color={p.text} />
          </Pressable>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={onSearch}
            returnKeyType="search"
            placeholder="Search a city, beach, neighborhood…"
            placeholderTextColor={p.textSecondary}
            style={[styles.input, { color: p.text }]}
          />
          <Pressable onPress={onSearch} accessibilityLabel="Search">
            <Icon sf="magnifyingglass.circle.fill" size={26} color={p.accent} />
          </Pressable>
        </Glass>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chipsRow}>
          <Pressable
            onPress={toggleEvents}
            accessibilityRole="button"
            accessibilityState={{ selected: showEvents }}
            style={({ pressed }) => [
              styles.filterChip,
              {
                backgroundColor: showEvents ? p.accent : p.card,
                borderColor: p.accent,
                opacity: pressed ? 0.85 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              },
            ]}>
            <Icon sf="pawprint.fill" size={12} color={showEvents ? p.onAccent : p.accent} />
            <Text style={[styles.filterLabel, { color: showEvents ? p.onAccent : p.text }]}>
              Events
            </Text>
          </Pressable>
          {ALL_CATEGORIES.map((c) => {
            const active = enabled.has(c);
            const color = CATEGORY_COLORS[c].stroke;
            return (
              <Pressable
                key={c}
                onPress={() => toggle(c)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: active ? color : p.card,
                    borderColor: color,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}>
                <Text
                  style={[styles.filterLabel, { color: active ? '#fff' : p.text }]}>
                  {CATEGORY_LABELS[c]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <KeyboardAvoidingView
        style={[styles.bottomBar, { bottom: Math.max(insets.bottom, 12) }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none">
        {selected ? (
          <Glass style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: p.text }]} numberOfLines={2}>
                  {selected.name}
                </Text>
                <Text style={[styles.sheetMeta, { color: p.textSecondary }]}>
                  {CATEGORY_LABELS[selected.category]}
                  {'  ·  '}
                  <Text style={{ color: p.accent }}>
                    {stars(rating)} {rating.toFixed(1)}
                  </Text>
                  {reviewCount > 0 ? (
                    <Text style={{ color: p.textSecondary }}>
                      {'  ·  '}
                      {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
                    </Text>
                  ) : null}
                </Text>
              </View>
              <Pressable onPress={() => setSelected(null)} accessibilityLabel="Close details">
                <Icon sf="xmark.circle.fill" size={24} color={p.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.hoursRow}>
              <Icon sf="clock" size={14} color={p.accent} />
              <Text style={[styles.hoursText, { color: p.text }]} numberOfLines={2}>
                {selected.openingHours ?? 'Hours not listed on OpenStreetMap'}
              </Text>
            </View>

            <ScrollView style={styles.reviewScroll}>
              <Text style={[styles.reviewLabel, { color: p.textSecondary }]}>
                COMMUNITY REVIEWS
              </Text>
              {reviews.map((r, i) => (
                <View key={r.reviewId ?? `demo-${i}`} style={styles.reviewRow}>
                  <Image source={{ uri: r.avatarUrl }} style={styles.reviewAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reviewAuthor, { color: p.text }]}>
                      {r.author}
                      {'  '}
                      <Text style={{ color: p.accent, fontSize: 11 }}>{stars(r.rating)}</Text>
                      <Text style={{ color: p.textSecondary, fontWeight: '400', fontSize: 11 }}>
                        {'  '}
                        {r.when}
                      </Text>
                    </Text>
                    <Text style={[styles.reviewText, { color: p.text }]}>{r.text}</Text>
                  </View>
                  {r.mine && r.reviewId ? (
                    <View style={styles.reviewRowActions}>
                      <Pressable
                        onPress={() => editReview(r.reviewId!)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Edit your review">
                        <Icon sf="pencil" size={16} color={p.textSecondary} />
                      </Pressable>
                      <Pressable
                        onPress={() => deleteReview(r.reviewId!)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Delete your review">
                        <Icon sf="trash" size={16} color={p.danger} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>

            <View style={styles.composer}>
              <View style={styles.composerHead}>
                <Text style={[styles.reviewLabel, { color: p.textSecondary }]}>
                  {editingId ? 'EDITING YOUR REVIEW' : 'LEAVE A REVIEW'}
                </Text>
                {editingId ? (
                  <Pressable
                    onPress={resetComposer}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel editing">
                    <Text style={[styles.deleteLink, { color: p.textSecondary }]}>Cancel</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.starPicker}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setMyRating(n)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate ${n} star${n === 1 ? '' : 's'}`}>
                    <Icon
                      sf={n <= myRating ? 'star.fill' : 'star'}
                      size={22}
                      color={n <= myRating ? p.accent : p.textSecondary}
                    />
                  </Pressable>
                ))}
                <Text style={[styles.composerHint, { color: p.textSecondary }]}>
                  {myRating ? `${myRating}/5` : 'Tap to rate'}
                </Text>
              </View>
              <View style={styles.composerInputRow}>
                <TextInput
                  value={myText}
                  onChangeText={setMyText}
                  placeholder="Share a tip for other dog owners…"
                  placeholderTextColor={p.textSecondary}
                  multiline
                  style={[
                    styles.composerInput,
                    { color: p.text, borderColor: p.separator, backgroundColor: p.card },
                  ]}
                />
                <Pressable
                  onPress={submitReview}
                  disabled={!canReview}
                  accessibilityRole="button"
                  accessibilityLabel={editingId ? 'Save review' : 'Post review'}
                  style={[
                    styles.sendBtn,
                    { backgroundColor: canReview ? p.accent : p.chipBg },
                  ]}>
                  <Icon
                    sf={editingId ? 'checkmark' : 'paperplane.fill'}
                    size={16}
                    color={canReview ? '#fff' : p.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.sheetActions}>
              <Chip
                small
                label="Open in Apple Maps"
                sf="map.fill"
                selected
                onPress={() =>
                  Linking.openURL(
                    `http://maps.apple.com/?ll=${selected.center.latitude},${selected.center.longitude}&q=${encodeURIComponent(selected.name)}`,
                  )
                }
              />
              {selected.website ? (
                <Chip
                  small
                  label="Website"
                  sf="safari"
                  onPress={() => Linking.openURL(selected.website!)}
                />
              ) : null}
            </View>
          </Glass>
        ) : (
          <>
            {error ? (
              <Glass style={styles.statusChip}>
                <Text style={[styles.statusText, { color: p.danger }]}>{error}</Text>
                <Pressable onPress={searchThisArea}>
                  <Text style={[styles.searchArea, { color: p.accent }]}>Retry</Text>
                </Pressable>
              </Glass>
            ) : null}
            <Glass style={styles.statusChip}>
              {loading ? (
                <>
                  <PawkLogo size={26} />
                  <ActivityIndicator size="small" color={p.accent} />
                  <Text style={[styles.statusText, { color: p.text }]}>Sniffing out spots…</Text>
                </>
              ) : visible.length === 0 && !error ? (
                <>
                  <Text style={[styles.statusText, { color: p.textSecondary }]}>
                    {places.length === 0
                      ? 'No dog-friendly spots here'
                      : 'None match your filters'}
                  </Text>
                  <Pressable onPress={searchThisArea}>
                    <Text style={[styles.searchArea, { color: p.accent }]}>Search this area</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={styles.legendSwatch} />
                  <Text style={[styles.statusText, { color: p.text }]}>
                    {visible.length} dog-friendly place{visible.length === 1 ? '' : 's'}
                  </Text>
                  <Pressable onPress={searchThisArea}>
                    <Text style={[styles.searchArea, { color: p.accent }]}>Search this area</Text>
                  </Pressable>
                </>
              )}
            </Glass>
          </>
        )}
        <Text style={[styles.attribution, { color: p.textSecondary }]}>
          Map data © OpenStreetMap contributors
        </Text>
      </KeyboardAvoidingView>

      {!selected ? (
        <View style={[styles.legendWrap, { bottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
          {legendOpen ? (
            <Glass style={styles.legendCard}>
              {ALL_CATEGORIES.map((c) => (
                <View key={c} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: CATEGORY_COLORS[c].stroke }]} />
                  <Text style={[styles.legendText, { color: p.text }]}>{CATEGORY_LABELS[c]}</Text>
                </View>
              ))}
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: p.accent }]} />
                <Text style={[styles.legendText, { color: p.text }]}>Events</Text>
              </View>
            </Glass>
          ) : null}
          <Pressable
            onPress={() => setLegendOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={legendOpen ? 'Hide map key' : 'Show map key'}>
            <Glass style={styles.legendBtn}>
              <Icon sf={legendOpen ? 'xmark' : 'list.bullet'} size={16} color={p.text} />
            </Glass>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBars: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    gap: Spacing.two,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: Radii.lg,
  },
  input: { flex: 1, fontSize: 15, fontWeight: '600', paddingVertical: 2 },
  chipsRow: { flexDirection: 'row', gap: 6, paddingRight: Spacing.three },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  filterLabel: { fontSize: 12, fontWeight: '700', fontFamily: Fonts?.rounded },
  logoPin: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  eventPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  legendWrap: { position: 'absolute', left: Spacing.three, alignItems: 'flex-start', gap: 8 },
  legendCard: { borderRadius: Radii.md, padding: Spacing.two, gap: 6, overflow: 'hidden' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 13, fontWeight: '600' },
  legendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bottomBar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
    gap: 6,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: Radii.lg,
  },
  statusText: { fontSize: 13, fontWeight: '700', fontFamily: Fonts?.rounded },
  searchArea: { fontSize: 13, fontWeight: '800' },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(22,163,74,0.35)',
    borderWidth: 1.5,
    borderColor: '#15803D',
  },
  attribution: { fontSize: 10 },
  sheet: {
    alignSelf: 'stretch',
    borderRadius: Radii.xl,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  sheetTitle: { fontSize: 18, fontWeight: '800', fontFamily: Fonts?.rounded },
  sheetMeta: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hoursText: { fontSize: 13, fontWeight: '600', flex: 1 },
  reviewScroll: { maxHeight: 190 },
  reviewLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  reviewRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
  reviewRowActions: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start', paddingTop: 1 },
  reviewAvatar: { width: 30, height: 30, borderRadius: 15 },
  reviewAuthor: { fontSize: 13, fontWeight: '700' },
  reviewText: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  sheetActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  composer: { gap: Spacing.two, marginTop: Spacing.half },
  composerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deleteLink: { fontSize: 12, fontWeight: '700' },
  starPicker: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  composerHint: { fontSize: 12, fontWeight: '600', marginLeft: Spacing.one },
  composerInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 96,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: 9,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
