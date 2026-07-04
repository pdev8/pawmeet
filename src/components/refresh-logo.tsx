import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  AnimatedPath,
  earPath,
  HEAD_CORE_D,
  HeadFeatures,
  LEFT_EAR_POSES,
  RIGHT_EAR_POSES,
  strokeProps,
} from './logo';
import { usePalette } from '@/hooks/use-palette';

export type RefreshPhase = 'idle' | 'shake' | 'spin';

// Comic twirl arcs circling the face (head center ≈ 60,52 in viewBox coords).
const SWIRL_ARCS = [
  'M 112 52 A 52 52 0 0 1 88 96',
  'M 8 52 A 52 52 0 0 1 32 8',
  'M 40 100 A 52 52 0 0 1 14 78',
];

const AnimatedSvgPath = AnimatedPath;

/**
 * Pull-to-refresh mascot with three phases:
 * - pulling: ears lift slowly, tracking the pull distance
 * - shake:   fast wet-dog shake — head whips side to side, ears flail
 * - spin:    finish flourish — the whole face does a 360 with ears dragged
 *            out flat and comic twirl lines swirling around it
 */
export function PawkRefreshLogo({
  size = 56,
  pullProgress,
  phase,
}: {
  size?: number;
  pullProgress: Animated.AnimatedInterpolation<number>;
  phase: RefreshPhase;
}) {
  const p = usePalette();
  const stroke = strokeProps(p.accent);
  const shake = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase === 'shake') {
      // Wet-dog shake: ~4 full whips per second, clearly faster than the
      // slow pull-lift. Loops until the phase changes.
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(shake, {
            toValue: 1,
            duration: 60,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
          Animated.timing(shake, {
            toValue: -1,
            duration: 120,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
          Animated.timing(shake, {
            toValue: 0,
            duration: 60,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
        ]),
      );
      loop.start();
      return () => {
        loop.stop();
        shake.setValue(0);
      };
    }
    if (phase === 'spin') {
      spin.setValue(0);
      Animated.timing(spin, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return () => spin.setValue(0);
    }
  }, [phase, shake, spin]);

  // --- Shake phase ---
  const shakeLeftD = shake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [
      earPath(LEFT_EAR_POSES[2]),
      earPath(LEFT_EAR_POSES[0]),
      earPath(LEFT_EAR_POSES[1]),
    ],
  });
  const shakeRightD = shake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [
      earPath(RIGHT_EAR_POSES[1]),
      earPath(RIGHT_EAR_POSES[0]),
      earPath(RIGHT_EAR_POSES[2]),
    ],
  });
  const headTilt = shake.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-16deg', '16deg'],
  });

  // --- Spin phase: full 360, ears flung out for the ride, then settle ---
  const spinRotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const spinLeftD = spin.interpolate({
    inputRange: [0, 0.18, 0.8, 1],
    outputRange: [
      earPath(LEFT_EAR_POSES[0]),
      earPath(LEFT_EAR_POSES[2]),
      earPath(LEFT_EAR_POSES[2]),
      earPath(LEFT_EAR_POSES[0]),
    ],
  });
  const spinRightD = spin.interpolate({
    inputRange: [0, 0.18, 0.8, 1],
    outputRange: [
      earPath(RIGHT_EAR_POSES[0]),
      earPath(RIGHT_EAR_POSES[2]),
      earPath(RIGHT_EAR_POSES[2]),
      earPath(RIGHT_EAR_POSES[0]),
    ],
  });
  const swirlOpacity = spin.interpolate({
    inputRange: [0, 0.12, 0.7, 1],
    outputRange: [0, 1, 1, 0],
  });

  // --- Pull phase: ears lift gently with the pull ---
  const pullLeftD = pullProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [earPath(LEFT_EAR_POSES[0]), earPath(LEFT_EAR_POSES[1])],
  });
  const pullRightD = pullProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [earPath(RIGHT_EAR_POSES[0]), earPath(RIGHT_EAR_POSES[1])],
  });

  const leftD = phase === 'shake' ? shakeLeftD : phase === 'spin' ? spinLeftD : pullLeftD;
  const rightD = phase === 'shake' ? shakeRightD : phase === 'spin' ? spinRightD : pullRightD;
  const rotate = phase === 'shake' ? headTilt : phase === 'spin' ? spinRotate : '0deg';

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      {/* Widened viewBox so the swirl arcs fit around the face; its center
          matches the head center so the spin pivots on the nose. */}
      <Svg width={size * 1.3} height={size * 1.3} viewBox="-15 -20 150 145">
        {phase === 'spin'
          ? SWIRL_ARCS.map((d) => (
              <AnimatedSvgPath
                key={d}
                d={d}
                stroke={p.accent}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray="18 10"
                fill="none"
                opacity={swirlOpacity as unknown as number}
              />
            ))
          : null}
        <Path d={HEAD_CORE_D} {...stroke} />
        <AnimatedSvgPath d={leftD as unknown as string} {...stroke} />
        <AnimatedSvgPath d={rightD as unknown as string} {...stroke} />
        <HeadFeatures color={p.accent} />
      </Svg>
    </Animated.View>
  );
}
