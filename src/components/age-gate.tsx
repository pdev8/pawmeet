import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PawkLogo } from '@/components/logo';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { GUIDELINES } from '@/constants/guidelines';
import { useStore } from '@/lib/store';

/**
 * One-time 17+ confirmation shown before the app is usable, plus the community
 * guidelines up front (App Store requires both for a UGC app). The full
 * guidelines are also reachable from Profile and each event.
 */
export function AgeGate() {
  const p = usePalette();
  const confirmAge = useStore((s) => s.confirmAge);

  const decline = () =>
    Alert.alert(
      'Sorry — you must be 17 or older',
      'Pawk is intended for adults arranging pet meetups. Come back when you’re 17+.',
    );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p.background }]}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.brand}>
          <PawkLogo size={56} />
          <Text style={[styles.title, { color: p.text }]}>Welcome to Pawk</Text>
          <Text style={[styles.tagline, { color: p.textSecondary }]}>
            Real-world dog meetups. A quick check before you start.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.separator }]}>
          <Text style={[styles.cardTitle, { color: p.text }]}>Community Guidelines</Text>
          {GUIDELINES.map((g) => (
            <View key={g.title} style={styles.rule}>
              <Text style={[styles.ruleTitle, { color: p.text }]}>{g.title}</Text>
              <Text style={[styles.ruleBody, { color: p.textSecondary }]}>{g.body}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.legal, { color: p.textSecondary }]}>
          By continuing you confirm you are 17 or older and agree to follow these guidelines.
        </Text>

        <Pressable
          onPress={confirmAge}
          accessibilityRole="button"
          style={[styles.cta, { backgroundColor: p.accent }]}>
          <Text style={[styles.ctaText, { color: p.onAccent }]}>I’m 17 or older — continue</Text>
        </Pressable>

        <Pressable onPress={decline} hitSlop={8} style={styles.decline}>
          <Text style={[styles.declineText, { color: p.textSecondary }]}>I’m under 17</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: Spacing.four, gap: Spacing.three, flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', gap: 4, marginBottom: Spacing.two },
  title: { fontSize: 28, fontWeight: '800', fontFamily: Fonts?.rounded },
  tagline: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  card: {
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', fontFamily: Fonts?.rounded, marginBottom: 2 },
  rule: { gap: 2 },
  ruleTitle: { fontSize: 14, fontWeight: '700' },
  ruleBody: { fontSize: 13, lineHeight: 18 },
  legal: { fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  cta: { borderRadius: Radii.lg, paddingVertical: 15, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '800', fontFamily: Fonts?.rounded },
  decline: { alignItems: 'center', paddingVertical: Spacing.two },
  declineText: { fontSize: 14, fontWeight: '600' },
});
