import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { usePalette } from '@/hooks/use-palette';

// Head outline without either ear — both ears are separate, animatable paths
// hanging from the skull at (39,34) and (80,34).
export const HEAD_CORE_D = `M 39 34
  C 45 27 52 24 60 24
  C 68 24 75 27 80 32
  C 81 43 81 53 80 63
  C 78 74 72 83 65 86
  C 61 88 53 88 49 85
  C 43 81 39 73 38 63
  C 37 53 37 43 39 34 Z`;

// Ear keyframes. Each ear is a floppy lobe whose attachment point never
// moves; the lobe bends and the tip travels furthest, like fabric. Poses:
// 0 = hanging at rest, 1 = mid-lift, 2 = fully lifted/streaming.
export const LEFT_EAR_POSES: number[][] = [
  [39, 34, 30, 34, 22, 43, 21, 55, 20, 65, 25, 75, 32, 77, 36, 78, 38, 73, 38, 68],
  [39, 34, 27, 32, 17, 38, 14, 48, 12, 57, 16, 68, 24, 72, 28, 74, 32, 70, 33, 64],
  [39, 34, 26, 28, 14, 28, 9, 36, 5, 43, 7, 54, 15, 59, 19, 62, 24, 59, 26, 53],
];

// Mirror of the left ear around the head's vertical center (x -> 119 - x).
export const RIGHT_EAR_POSES: number[][] = [
  [80, 34, 89, 34, 97, 43, 98, 55, 99, 65, 94, 75, 87, 77, 83, 78, 81, 73, 81, 68],
  [80, 34, 92, 32, 102, 38, 105, 48, 107, 57, 103, 68, 95, 72, 91, 74, 87, 70, 86, 64],
  [80, 34, 93, 28, 105, 28, 110, 36, 114, 43, 112, 54, 104, 59, 100, 62, 95, 59, 93, 53],
];

export function earPath(n: number[]): string {
  return (
    `M ${n[0]} ${n[1]} ` +
    `C ${n[2]} ${n[3]} ${n[4]} ${n[5]} ${n[6]} ${n[7]} ` +
    `C ${n[8]} ${n[9]} ${n[10]} ${n[11]} ${n[12]} ${n[13]} ` +
    `C ${n[14]} ${n[15]} ${n[16]} ${n[17]} ${n[18]} ${n[19]}`
  );
}

export function strokeProps(color: string) {
  return {
    stroke: color,
    strokeWidth: 6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };
}

export function HeadFeatures({ color }: { color: string }) {
  return (
    <>
      <Circle cx={50} cy={48} r={3.4} fill={color} />
      <Circle cx={70} cy={48} r={3.4} fill={color} />
      <Ellipse cx={58} cy={70} rx={6} ry={4.5} fill={color} />
    </>
  );
}

export const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Pawk logo: outline of a golden retriever head, both ears floppy; the left
 * one occasionally lifts in the breeze like a slow flag.
 */
export function PawkLogo({
  size = 36,
  color,
  animated = true,
}: {
  size?: number;
  color?: string;
  animated?: boolean;
}) {
  const p = usePalette();
  const c = color ?? p.accent;
  const flap = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    // Path morphing runs on the JS driver (the `d` prop can't use the native
    // driver). One small path at header size — negligible cost.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flap, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(flap, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.delay(400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, flap]);

  const earD = flap.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: LEFT_EAR_POSES.map(earPath),
  });

  const stroke = strokeProps(c);

  return (
    <Svg width={size} height={size} viewBox="0 0 120 100">
      <Path d={HEAD_CORE_D} {...stroke} />
      <Path d={earPath(RIGHT_EAR_POSES[0])} {...stroke} />
      {animated ? (
        <AnimatedPath d={earD as unknown as string} {...stroke} />
      ) : (
        <Path d={earPath(LEFT_EAR_POSES[0])} {...stroke} />
      )}
      <HeadFeatures color={c} />
    </Svg>
  );
}
