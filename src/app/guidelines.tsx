import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, Spacing } from '@/constants/theme';
import { GUIDELINES } from '@/constants/guidelines';
import { usePalette } from '@/hooks/use-palette';

export default function GuidelinesScreen() {
  const p = usePalette();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.intro, { color: p.textSecondary }]}>
          Pawk is for real-world dog meetups between adults. Everyone agrees to these
          guidelines when they join — breaking them can get content removed or an account
          suspended.
        </Text>
        {GUIDELINES.map((g, i) => (
          <View key={g.title} style={styles.rule}>
            <Text style={[styles.ruleTitle, { color: p.text }]}>
              {i + 1}. {g.title}
            </Text>
            <Text style={[styles.ruleBody, { color: p.textSecondary }]}>{g.body}</Text>
          </View>
        ))}
        <Text style={[styles.footer, { color: p.textSecondary }]}>
          You must be 17 or older to use Pawk. To report a problem, use the Report option on an
          event or comment.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: Spacing.four, gap: Spacing.three },
  intro: { fontSize: 14, lineHeight: 20 },
  rule: { gap: 4 },
  ruleTitle: { fontSize: 16, fontWeight: '700', fontFamily: Fonts?.rounded },
  ruleBody: { fontSize: 14, lineHeight: 20 },
  footer: { fontSize: 13, lineHeight: 19, marginTop: Spacing.two },
});
