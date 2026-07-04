import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Linking,
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
import { useStore } from '@/lib/store';

const GREEN = {
  dog_park: { fill: 'rgba(22,163,74,0.20)', stroke: '#15803D', hatch: 'rgba(21,128,61,0.65)' },
  park: { fill: 'rgba(34,160,91,0.12)', stroke: '#22A05B', hatch: 'rgba(34,160,91,0.45)' },
  nature_reserve: {
    fill: 'rgba(52,145,80,0.12)',
    stroke: '#349150',
    hatch: 'rgba(52,145,80,0.45)',
  },
  beach: { fill: 'rgba(16,150,110,0.12)', stroke: '#10966E', hatch: 'rgba(16,150,110,0.45)' },
  trail: { fill: '', stroke: '#16A34A', hatch: '' },
} as const;

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as PlaceCategory[];
// Hatching every polygon gets heavy; hatch the most important ones and
// render the rest with fill + outline only.
const MAX_HATCHED = 22;
// The biggest areas (plus every dog park) get a Pawk pin for legibility.
const MAX_LOGO_PINS = 8;

function stars(rating: number): string {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

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
  const [enabled, setEnabled] = useState<Set<PlaceCategory>>(new Set(ALL_CATEGORIES));
  const [selected, setSelected] = useState<DogPlace | null>(null);

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
      return next;
    });

  const reviews = selected ? demoReviews(selected, reviewers) : [];
  const rating = selected ? placeRating(selected) : 0;

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
          const colors = GREEN[pl.category];
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
                  { backgroundColor: p.card, borderColor: GREEN[pl.category].stroke },
                ]}>
                <PawkLogo size={22} animated={false} />
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

        <View style={styles.chipsRow}>
          {ALL_CATEGORIES.map((c) => (
            <Chip
              key={c}
              small
              label={CATEGORY_LABELS[c]}
              selected={enabled.has(c)}
              onPress={() => toggle(c)}
            />
          ))}
        </View>
      </View>

      <View style={[styles.bottomBar, { bottom: Math.max(insets.bottom, 12) }]}>
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
                COMMUNITY REVIEWS · DEMO
              </Text>
              {reviews.map((r, i) => (
                <View key={i} style={styles.reviewRow}>
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
                </View>
              ))}
            </ScrollView>

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
              </Glass>
            ) : null}
            <Glass style={styles.statusChip}>
              {loading ? (
                <>
                  <PawkLogo size={26} />
                  <ActivityIndicator size="small" color={p.accent} />
                  <Text style={[styles.statusText, { color: p.text }]}>Sniffing out spots…</Text>
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
      </View>
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
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  logoPin: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
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
  reviewAvatar: { width: 30, height: 30, borderRadius: 15 },
  reviewAuthor: { fontSize: 13, fontWeight: '700' },
  reviewText: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  sheetActions: { flexDirection: 'row', gap: Spacing.two },
});
