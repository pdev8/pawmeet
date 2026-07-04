import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';

// Web stub: react-native-maps is native-only and cannot bundle for web.
// The full map experience runs on iOS (Expo Go / device). This placeholder
// keeps the web build working so every other flow is testable in a browser.
export default function MapScreenWeb() {
  const router = useRouter();
  const palette = usePalette();
  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Text style={[styles.title, { color: palette.text }]}>Map view</Text>
      <Text style={[styles.body, { color: palette.textSecondary }]}>
        The interactive map runs on iOS (Expo Go). It isn&apos;t available in the
        web preview because it relies on native map components.
      </Text>
      <Pressable onPress={() => router.back()} style={[styles.btn, { backgroundColor: palette.accent }]}>
        <Text style={styles.btnText}>Go back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: Spacing.md },
  title: { fontFamily: Fonts.rounded, fontSize: 24, fontWeight: '800' },
  body: { fontSize: 15, textAlign: 'center', maxWidth: 340, lineHeight: 21 },
  btn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, marginTop: Spacing.sm },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
