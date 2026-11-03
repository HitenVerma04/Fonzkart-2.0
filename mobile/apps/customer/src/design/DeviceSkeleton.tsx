// Loading placeholders shaped like what is coming: a phone outline before a phone's picture, a laptop with its base
// before a laptop's, a watch on its strap, a TV on its stand... and a wide pill before a brand logo. Each part carries
// the usual shimmer, and a soft green scan line runs down the outline, as if Fonzkart were checking the device.
import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useColors } from '@fonzkart/ui';
import { Skeleton } from './Shimmer';

export type DeviceKind = 'phone' | 'tablet' | 'laptop' | 'watch' | 'tv' | 'console' | 'desktop' | 'earbuds' | 'camera' | 'logo';

/** The silhouette for a sell category id (smartphone, smarttv, ...); phones when unknown. */
export function deviceKindOf(category: string | null | undefined): DeviceKind {
  switch ((category ?? '').toLowerCase()) {
    case 'tablet': case 'ipad': return 'tablet';
    case 'laptop': return 'laptop';
    case 'watch': case 'smartwatch': return 'watch';
    case 'smarttv': case 'tv': return 'tv';
    case 'console': return 'console';
    case 'desktop': return 'desktop';
    case 'earbuds': return 'earbuds';
    case 'camera': return 'camera';
    default: return 'phone';
  }
}

type Part = { x: number; y: number; w: number; h: number; r: number };

/** Parts of each silhouette, in fractions of the square it fills (x, y, width, height, corner radius). */
const SHAPES: Record<DeviceKind, Part[]> = {
  phone: [{ x: 0.27, y: 0.04, w: 0.46, h: 0.92, r: 0.09 }],
  tablet: [{ x: 0.14, y: 0.08, w: 0.72, h: 0.84, r: 0.07 }],
  laptop: [
    { x: 0.12, y: 0.16, w: 0.76, h: 0.5, r: 0.04 },
    { x: 0.04, y: 0.68, w: 0.92, h: 0.08, r: 0.03 },
  ],
  watch: [
    { x: 0.36, y: 0.02, w: 0.28, h: 0.96, r: 0.08 },
    { x: 0.22, y: 0.24, w: 0.56, h: 0.52, r: 0.16 },
  ],
  tv: [
    { x: 0.04, y: 0.16, w: 0.92, h: 0.56, r: 0.03 },
    { x: 0.3, y: 0.76, w: 0.4, h: 0.05, r: 0.02 },
  ],
  console: [{ x: 0.08, y: 0.3, w: 0.84, h: 0.42, r: 0.2 }],
  desktop: [
    { x: 0.1, y: 0.1, w: 0.8, h: 0.54, r: 0.04 },
    { x: 0.45, y: 0.64, w: 0.1, h: 0.14, r: 0 },
    { x: 0.3, y: 0.78, w: 0.4, h: 0.05, r: 0.02 },
  ],
  earbuds: [
    { x: 0.24, y: 0.12, w: 0.18, h: 0.3, r: 0.09 },
    { x: 0.58, y: 0.12, w: 0.18, h: 0.3, r: 0.09 },
    { x: 0.2, y: 0.48, w: 0.6, h: 0.4, r: 0.18 },
  ],
  camera: [
    { x: 0.3, y: 0.18, w: 0.22, h: 0.1, r: 0.03 },
    { x: 0.08, y: 0.26, w: 0.84, h: 0.54, r: 0.08 },
  ],
  logo: [{ x: 0.08, y: 0.33, w: 0.84, h: 0.34, r: 0.17 }],
};

export function DeviceSkeleton({ kind, size }: { kind: DeviceKind; size: number }) {
  const colors = useColors();
  const scan = useSharedValue(0);
  useEffect(() => {
    scan.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(scan);
  }, [scan]);
  const line = useAnimatedStyle(() => ({ transform: [{ translateY: scan.value * size * 0.9 }], opacity: 0.25 + 0.5 * Math.sin(scan.value * Math.PI) }));
  const parts = SHAPES[kind];

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {parts.map((p, i) => {
        const style: ViewStyle = { position: 'absolute', left: p.x * size, top: p.y * size };
        return (
          <View key={i} style={style}>
            <Skeleton width={p.w * size} height={p.h * size} radius={p.r * size} />
          </View>
        );
      })}
      {/* the camera's lens and the phone's camera dot, a shade darker */}
      {kind === 'camera' ? (
        <View style={{ position: 'absolute', left: size * 0.33, top: size * 0.36, width: size * 0.34, height: size * 0.34, borderRadius: size * 0.17, borderWidth: size * 0.04, borderColor: colors.track }} />
      ) : null}
      {kind === 'phone' ? (
        <View style={{ position: 'absolute', left: size * 0.47, top: size * 0.09, width: size * 0.06, height: size * 0.06, borderRadius: size * 0.03, backgroundColor: colors.track }} />
      ) : null}
      {kind !== 'logo' ? (
        <Animated.View
          pointerEvents="none"
          style={[{
            position: 'absolute', left: size * 0.06, right: size * 0.06, top: size * 0.03, height: 2, borderRadius: 1,
            backgroundImage: `linear-gradient(90deg, transparent 0%, ${colors.green} 50%, transparent 100%)`,
          }, line]}
        />
      ) : null}
    </View>
  );
}
