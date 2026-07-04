import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform, StyleSheet, useColorScheme, View, type ViewProps } from 'react-native';

import { usePalette } from '@/hooks/use-palette';

/**
 * Liquid Glass surface: native UIGlassEffect on iOS 26+, blur on older iOS,
 * translucent fill elsewhere. Give it a borderRadius via `style`.
 */
export function Glass({ style, children, ...rest }: ViewProps) {
  const p = usePalette();
  const scheme = useColorScheme();

  if (Platform.OS === 'ios' && isLiquidGlassAvailable()) {
    return (
      <GlassView glassEffectStyle="regular" style={[styles.clip, style]} {...rest}>
        {children}
      </GlassView>
    );
  }
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={50}
        tint={scheme === 'dark' ? 'systemMaterialDark' : 'systemMaterialLight'}
        style={[styles.clip, style]}
        {...rest}>
        {children}
      </BlurView>
    );
  }
  return (
    <View style={[styles.clip, { backgroundColor: p.glassFallback }, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
