import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from './chip';
import { Glass } from './glass';
import { Fonts, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { BREEDS } from '@/lib/breeds';
import { DEFAULT_FILTERS, type DateWindow, type Filters } from '@/lib/filters';
import { VENUE_ICONS, VENUE_LABELS, type VenueType } from '@/lib/types';

const RADII = [5, 10, 25, 50];
const WINDOWS: { value: DateWindow; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'weekend', label: 'This weekend' },
  { value: '7d', label: 'Next 7 days' },
  { value: '30d', label: 'Next 30 days' },
];
const VENUES = Object.keys(VENUE_LABELS) as VenueType[];

export function FilterSheet({
  visible,
  filters,
  onApply,
  onClose,
}: {
  visible: boolean;
  filters: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Filters>(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const toggleVenue = (v: VenueType) =>
    setDraft((d) => ({
      ...d,
      venues: d.venues.includes(v) ? d.venues.filter((x) => x !== v) : [...d.venues, v],
    }));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: p.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.heading, { color: p.text }]}>Filters</Text>

          <Text style={[styles.section, { color: p.textSecondary }]}>DISTANCE</Text>
          <View style={styles.wrapRow}>
            {RADII.map((r) => (
              <Chip
                key={r}
                label={`${r} mi`}
                selected={draft.radiusMi === r}
                onPress={() => setDraft((d) => ({ ...d, radiusMi: r }))}
              />
            ))}
          </View>

          <Text style={[styles.section, { color: p.textSecondary }]}>WHEN</Text>
          <View style={styles.wrapRow}>
            {WINDOWS.map((w) => (
              <Chip
                key={w.value}
                label={w.label}
                selected={draft.dateWindow === w.value}
                onPress={() => setDraft((d) => ({ ...d, dateWindow: w.value }))}
              />
            ))}
          </View>

          <Text style={[styles.section, { color: p.textSecondary }]}>BREED</Text>
          <Text style={[styles.hint, { color: p.textSecondary }]}>
            Shows breed-focused meetups plus all-breeds events.
          </Text>
          <View style={styles.wrapRow}>
            <Chip
              label="Any breed"
              selected={draft.breed === null}
              onPress={() => setDraft((d) => ({ ...d, breed: null }))}
            />
            {BREEDS.map((b) => (
              <Chip
                key={b}
                label={b}
                selected={draft.breed === b}
                onPress={() => setDraft((d) => ({ ...d, breed: b }))}
              />
            ))}
          </View>

          <Text style={[styles.section, { color: p.textSecondary }]}>VENUE</Text>
          <View style={styles.wrapRow}>
            {VENUES.map((v) => (
              <Chip
                key={v}
                label={VENUE_LABELS[v]}
                sf={VENUE_ICONS[v]}
                selected={draft.venues.includes(v)}
                onPress={() => toggleVenue(v)}
              />
            ))}
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: p.text }]}>Has spots left</Text>
            <Switch
              value={draft.hasSpots}
              onValueChange={(v) => setDraft((d) => ({ ...d, hasSpots: v }))}
              trackColor={{ true: p.accent }}
            />
          </View>
          <View style={{ height: 120 }} />
        </ScrollView>

        <Glass style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
          <Chip
            label="Reset"
            onPress={() => setDraft({ ...DEFAULT_FILTERS, sort: draft.sort })}
            style={styles.footerBtn}
          />
          <Chip
            label="Show events"
            selected
            onPress={() => {
              onApply(draft);
              onClose();
            }}
            style={styles.footerBtn}
          />
        </Glass>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.two },
  heading: { fontSize: 26, fontWeight: '800', fontFamily: Fonts?.rounded, marginBottom: Spacing.two },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginTop: Spacing.three },
  hint: { fontSize: 12, marginBottom: 2 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: {
    marginTop: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: { fontSize: 16, fontWeight: '600' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  footerBtn: { flex: 1, justifyContent: 'center', paddingVertical: 14 },
});
