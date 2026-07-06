import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Icon } from './icon';
import { Radii, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { confirmDestructive } from '@/lib/confirm';

interface SwipeableRowProps {
  /** The row content — a single host view (e.g. a styled <View>). */
  children: ReactElement;
  /** Tap handler. Uses a gesture Tap so a swipe cancels it (no accidental taps). */
  onPress?: () => void;
  /** When set, swiping left reveals a red destructive action that confirms first. */
  onDelete?: () => void;
  deleteLabel?: string;
  /** Confirm dialog copy (defaults are generic). */
  confirmTitle?: string;
  confirmMessage?: string;
  deleteIcon?: string;
}

/**
 * A list row with tap-to-open + swipe-left-to-delete. The tap is a gesture (so a
 * swipe never fires it), and cancelling the confirm snaps the row closed.
 * Reusable anywhere a swipe-to-delete list row is needed.
 */
export function SwipeableRow({
  children,
  onPress,
  onDelete,
  deleteLabel = 'Delete',
  confirmTitle = 'Delete this item?',
  confirmMessage,
  deleteIcon = 'trash.fill',
}: SwipeableRowProps) {
  const p = usePalette();
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => onPress?.());

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={
        onDelete
          ? (_progress, _translation, swipeable) => (
              <View style={styles.actionWrap}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={deleteLabel}
                  onPress={() =>
                    confirmDestructive({
                      title: confirmTitle,
                      message: confirmMessage,
                      confirmLabel: deleteLabel,
                      onConfirm: onDelete,
                      onCancel: () => swipeable.close(),
                    })
                  }
                  style={[styles.action, { backgroundColor: p.danger }]}>
                  <Icon sf={deleteIcon} size={18} color="#fff" />
                  <Text style={styles.actionText}>{deleteLabel}</Text>
                </Pressable>
              </View>
            )
          : undefined
      }>
      <GestureDetector gesture={tap}>{children}</GestureDetector>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  actionWrap: { paddingLeft: Spacing.two, height: '100%' },
  action: {
    flex: 1,
    width: 84,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    borderRadius: Radii.md,
  },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
