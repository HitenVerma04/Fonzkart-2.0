// The Customer app's bottom tabs (Sell, Buy, Repair, My orders, Profile): a floating glass bar. A green-tinted pill
// springs to the chosen tab, whose icon fills in, lifts and pops; presses also ripple in green on Android.
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { makeStyles, useColors } from '@fonzkart/ui';
import { Glass, Icon, motion, radii, TAB_BAR_HEIGHT, Tap, type IconName } from '../design';

/** Route name → icon. Routes not listed get the Sell icon. */
const ICONS: Record<string, IconName> = { buy: 'buy', index: 'sell', repair: 'repair', orders: 'orders', profile: 'profile' };
const PAD = 6;

export function FonzkartTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const tabWidth = (width - PAD * 2) / state.routes.length;
  const x = useSharedValue(0);
  const placed = useSharedValue(false);

  useEffect(() => {
    if (!tabWidth) return;
    // The first placement jumps; later ones spring.
    x.value = placed.value ? withSpring(state.index * tabWidth, motion.snappy) : state.index * tabWidth;
    placed.value = true;
  }, [state.index, tabWidth, x, placed]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Glass strong radius={radii.pill} shadow="lg" style={styles.bar} onLayout={e => setWidth(e.nativeEvent.layout.width)} role="tablist">
        {tabWidth ? (
          <Animated.View pointerEvents="none" style={[styles.pillTrack, { width: tabWidth }, pill]}>
            <View style={styles.pill} />
          </Animated.View>
        ) : null}
        {state.routes.map((route, index) => {
          const focused = index === state.index;
          const { options } = descriptors[route.key]!;
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Tab key={route.key} label={label} icon={ICONS[route.name] ?? 'sell'} focused={focused} onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })} />
          );
        })}
      </Glass>
    </View>
  );
}

function Tab({ label, icon, focused, onPress, onLongPress }: {
  label: string;
  icon: IconName;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const scale = useSharedValue(1);
  const lift = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    lift.value = withSpring(focused ? 1 : 0, motion.snappy);
    if (focused) scale.value = withSequence(withTiming(1.12, { duration: 120 }), withSpring(1, motion.press));
  }, [focused, scale, lift]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -2 * lift.value }, { scale: scale.value }] }));
  const color = focused ? colors.green : colors.muted;

  return (
    <Tap
      onPress={onPress}
      onLongPress={onLongPress}
      scaleTo={0.9}
      role="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      android_ripple={{ color: colors.ripple, borderless: true, radius: 34 }}
      style={styles.tab}
    >
      <Animated.View style={iconStyle}>
        <Icon name={icon} color={color} size={23} filled={focused} />
      </Animated.View>
      <Text style={[styles.label, { color }, focused && styles.labelFocused]} numberOfLines={1}>{label}</Text>
    </Tap>
  );
}

const useStyles = makeStyles(colors => ({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, alignItems: 'center' },
  bar: { flexDirection: 'row', height: TAB_BAR_HEIGHT, padding: PAD, width: '100%', maxWidth: 520 },
  pillTrack: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, paddingHorizontal: 3 },
  pill: { flex: 1, borderRadius: radii.pill, backgroundColor: colors.greenTint, borderWidth: 1, borderColor: colors.greenBorder },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1 },
  label: { fontSize: 10.5, fontWeight: '600', letterSpacing: 0.1 },
  labelFocused: { fontWeight: '800' },
}));
