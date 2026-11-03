// The shimmering placeholder block every loading state is built from. One clock for all blocks on screen, so the
// light band sweeps across them together.
import { useEffect, useState } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, makeMutable, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { useColors } from '@fonzkart/ui';
import { radii, useDesign } from './tokens';

const clock = makeMutable(0);
let running = false;
function startClock() {
  if (running) return;
  running = true;
  clock.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false);
}

export function Skeleton({ width = '100%', height, radius = radii.sm, style }: {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const d = useDesign();
  const [w, setW] = useState(0);
  useEffect(startClock, []);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: -w + clock.value * w * 2 }] }));
  return (
    <View
      onLayout={e => setW(e.nativeEvent.layout.width)}
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.placeholder, overflow: 'hidden' }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {w ? (
        <Animated.View
          style={[
            { position: 'absolute', top: 0, bottom: 0, width: w, backgroundImage: `linear-gradient(90deg, transparent 0%, ${d.shimmer} 50%, transparent 100%)` },
            sweep,
          ]}
        />
      ) : null}
    </View>
  );
}
