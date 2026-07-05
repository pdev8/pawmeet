import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { EventCard } from '@/components/event-card';
import { FilterSheet } from '@/components/filter-sheet';
import { Icon } from '@/components/icon';
import { Glass } from '@/components/glass';
import { PawkLogo } from '@/components/logo';
import { PawkRefreshLogo, type RefreshPhase } from '@/components/refresh-logo';
import { BottomTabInset, Fonts, Radii, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  type Filters,
  type SortMode,
} from '@/lib/filters';
import { useDiscoverEvents } from '@/lib/use-events';
import { geocodeLocation } from '@/lib/places';
import { useStore } from '@/lib/store';

const SORTS: { value: SortMode; label: string }[] = [
  { value: 'soonest', label: 'Soonest' },
  { value: 'nearest', label: 'Nearest' },
  { value: 'popular', label: 'Popular' },
];

// LayoutAnimation needs a one-time opt-in on Android; a no-op on iOS.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const animateArea = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

export default function DiscoverScreen() {
  const p = usePalette();
  const router = useRouter();
  const store = useStore();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [searching, setSearching] = useState(false);
  const [areaQuery, setAreaQuery] = useState('');
  const [editingArea, setEditingArea] = useState(false);
  const [phase, setPhase] = useState<RefreshPhase>('idle');
  const scrollY = useRef(new Animated.Value(0)).current;
  // Animated spacer at the top of the list: opens while the mascot animates
  // so cards never overlap him, closes when he's done.
  const gap = useRef(new Animated.Value(0)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // 0 → 1 as the list is pulled down past the header.
  const pullProgress = scrollY.interpolate({
    inputRange: [-100, -25],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  // The mascot rides down inside the revealed pull gap (hidden above the
  // list edge at rest, clipped by the wrapper) so he can never sit on top
  // of the first card.
  const dogTranslate = scrollY.interpolate({
    inputRange: [-110, -20],
    outputRange: [0, -104],
    extrapolate: 'clamp',
  });

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // No native RefreshControl (its spinner can't be fully hidden) — we detect
  // the pull ourselves and run the mascot phases: shake while "fetching",
  // then a comic 360 spin to celebrate finishing.
  const startRefresh = () => {
    if (phase !== 'idle') return;
    setPhase('shake');
    useStore.getState().archiveSweep();
    refetch();
    Animated.timing(gap, {
      toValue: 96,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    timers.current = [
      setTimeout(() => setPhase('spin'), 1500),
      setTimeout(() => {
        setPhase('idle');
        Animated.timing(gap, {
          toValue: 0,
          duration: 350,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }).start();
      }, 2200),
    ];
  };

  // On first launch, re-center the demo data around the phone's real location
  // so distances feel real.
  useEffect(() => {
    if (!store.hasHydrated || store.seededWithGps) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        useStore.getState().adoptGpsCenter({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      } catch {
        // Location unavailable — demo data stays centered on the default city.
      }
    })();
  }, [store.hasHydrated, store.seededWithGps]);

  const { data: items = [], refetch } = useDiscoverEvents(store.center, filters);
  const nFilters = activeFilterCount(filters);

  // Geocode a free-text place (Nominatim, via places.ts) and re-center the demo
  // events on it. A real backend would just re-query events near the hit.
  const searchArea = (query: string) => {
    const q = query.trim();
    if (!q) return;
    setSearching(true); // clears the list + shows the spinner while we geocode
    (async () => {
      // Dev-only test hooks — stripped from production/release bundles by the
      // __DEV__ guard. 11111 = an empty area (test the no-events state);
      // 22222 = a slow lookup (test the loading state).
      if (__DEV__ && q === '11111') {
        useStore.setState({ events: {}, centerLabel: 'ZIP 11111' });
        setSearching(false);
        return;
      }
      if (__DEV__ && q === '22222') {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const s = useStore.getState();
        s.reseed(s.center, 'ZIP 22222');
        setSearching(false);
        return;
      }
      const hit = await geocodeLocation(q).catch(() => null);
      if (!hit) {
        setSearching(false);
        Alert.alert('Place not found', `Couldn't find "${q}". Try a city, neighborhood, or ZIP.`);
        return;
      }
      useStore.getState().reseed({ lat: hit.lat, lng: hit.lng }, hit.label);
      setSearching(false);
    })();
  };

  const toggleAreaEditor = () => {
    animateArea();
    setEditingArea((v) => !v);
    if (editingArea) {
      Keyboard.dismiss();
      setAreaQuery('');
    }
  };

  const closeAreaEditor = () => {
    Keyboard.dismiss();
    animateArea();
    setEditingArea(false);
    setAreaQuery('');
  };

  const submitArea = () => {
    if (!areaQuery.trim()) {
      closeAreaEditor();
      return;
    }
    searchArea(areaQuery);
    closeAreaEditor();
  };

  const goToMyLocation = async () => {
    closeAreaEditor();
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      useStore.getState().adoptGpsCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      Alert.alert('Could not get your location');
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p.background }]} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <PawkLogo size={38} />
          <Text style={[styles.title, { color: p.text }]}>Pawk</Text>
          <View style={{ flex: 1 }} />
          <Chip
            label="Map"
            sf="map.fill"
            selected
            onPress={() => router.push('/map')}
          />
        </View>
        <Pressable
          onPress={toggleAreaEditor}
          style={styles.areaRow}
          accessibilityRole="button"
          accessibilityLabel="Change location">
          <Icon sf="mappin.and.ellipse" size={14} color={p.accent} />
          <Text style={[styles.areaText, { color: p.textSecondary }]}>
            {store.centerLabel} · {filters.radiusMi} mi
          </Text>
          <Icon sf={editingArea ? 'chevron.up' : 'pencil'} size={12} color={p.textSecondary} />
        </Pressable>
        {editingArea ? (
          <View style={[styles.searchRow, { backgroundColor: p.card, borderColor: p.separator }]}>
            <Icon sf="magnifyingglass" size={16} color={p.textSecondary} />
            <TextInput
              value={areaQuery}
              onChangeText={setAreaQuery}
              onSubmitEditing={submitArea}
              returnKeyType="search"
              placeholder="City, state, or ZIP"
              placeholderTextColor={p.textSecondary}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              style={[styles.searchInput, { color: p.text }]}
            />
            <Pressable onPress={goToMyLocation} hitSlop={8} accessibilityLabel="Use my location">
              <Icon sf="location.fill" size={16} color={p.accent} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.controls}>
        {SORTS.map((s) => (
          <Chip
            key={s.value}
            small
            label={s.label}
            selected={filters.sort === s.value}
            onPress={() => setFilters((f) => ({ ...f, sort: s.value }))}
          />
        ))}
        <View style={{ flex: 1 }} />
        <Chip
          small
          sf="line.3.horizontal.decrease.circle"
          label={nFilters > 0 ? `Filters · ${nFilters}` : 'Filters'}
          selected={nFilters > 0}
          onPress={() => setShowFilters(true)}
        />
      </View>

      <View style={styles.listWrap}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.refreshLogo,
            {
              opacity: phase !== 'idle' ? 1 : pullProgress,
              transform: [{ translateY: phase !== 'idle' ? 0 : dogTranslate }],
            },
          ]}>
          <Glass style={styles.refreshChip}>
            <PawkRefreshLogo size={56} pullProgress={pullProgress} phase={phase} />
          </Glass>
        </Animated.View>
        <Animated.FlatList
          data={items}
          keyExtractor={(it) => it.event.id}
          renderItem={({ item }) => (
            <EventCard event={item.event} distanceMi={item.distanceMi} goingCount={item.goingCount} />
          )}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
          onScrollEndDrag={(e) => {
            if (e.nativeEvent.contentOffset.y <= -80) startRefresh();
          }}
          ListHeaderComponent={<Animated.View style={{ height: gap }} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: BottomTabInset + Spacing.four },
            items.length === 0 && styles.listEmpty,
          ]}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
          ListEmptyComponent={
            <EmptyState
              sf="pawprint.fill"
              title="No events found"
              subtitle="Try widening the radius or date range — or be the one who starts the first meetup around here."
              ctaLabel="Host an event"
              onCta={() => router.push('/post')}
            />
          }
        />
        {/* Opaque cover over just the events list — header + controls stay put. */}
        {searching ? (
          <View style={[styles.listCover, { backgroundColor: p.background }]} />
        ) : null}
      </View>

      {/* Transparent full-window layer so the mascot centers on the screen while
          the app frame (header, controls, tab bar) remains visible. */}
      {searching ? (
        <View style={styles.searchingOverlay} pointerEvents="none">
          <PawkRefreshLogo size={72} phase="loading" pullProgress={pullProgress} />
          <Text style={[styles.searchingText, { color: p.textSecondary }]}>
            Sniffing out events near you…
          </Text>
        </View>
      ) : null}

      <FilterSheet
        visible={showFilters}
        filters={filters}
        onApply={setFilters}
        onClose={() => setShowFilters(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: 2 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 32, fontWeight: '800', fontFamily: Fonts?.rounded },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600', paddingVertical: 0 },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 },
  areaText: { fontSize: 13, fontWeight: '600' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  list: { paddingHorizontal: Spacing.three, paddingTop: Spacing.one },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  listWrap: { flex: 1, overflow: 'hidden' },
  listCover: { ...StyleSheet.absoluteFillObject, zIndex: 40 },
  searchingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    zIndex: 50,
  },
  searchingText: { fontSize: 14, fontWeight: '600' },
  refreshLogo: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  refreshChip: {
    borderRadius: 48,
    padding: 6,
  },
});
