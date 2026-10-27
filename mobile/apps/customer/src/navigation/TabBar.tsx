// The Customer app's bottom tabs (Sell, Buy, Repair, My orders, Profile) in Fonzkart green: a light-green highlight springs to
// the chosen tab, its icon pops, and presses ripple in green on Android.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { makeStyles, useColors } from '@fonzkart/ui';
import { TabIcon, type TabIconName } from './TabIcon';

const SPRING = { damping: 18, stiffness: 220, mass: 0.6 };

/** Route name → icon. Routes not listed get the Sell icon. */
const ICONS: Record<string, TabIconName> = { buy: 'buy', index: 'sell', repair: 'repair', orders: 'orders', profile: 'profile' };

export function FonzkartTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const tabWidth = width / state.routes.length;
  const x = useSharedValue(0);
  const placed = useSharedValue(false);

  useEffect(() => {
    if (!tabWidth) return;
    // The first placement jumps; later ones spring.
    x.value = placed.value ? withSpring(state.index * tabWidth, SPRING) : state.index * tabWidth;
    placed.value = true;
  }, [state.index, tabWidth, x, placed]);

  const highlight = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]} onLayout={e => setWidth(e.nativeEvent.layout.width)} role="tablist">
      {tabWidth ? (
        <Animated.View pointerEvents="none" style={[styles.highlightTrack, { width: tabWidth }, highlight]}>
          <View style={styles.highlight} />
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
    </View>
  );
}

function Tab({ label, icon, focused, onPress, onLongPress }: {
  label: string;
  icon: TabIconName;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (focused) scale.value = withSequence(withTiming(1.18, { duration: 110 }), withSpring(1, SPRING));
  }, [focused, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const color = focused ? colors.green : colors.muted;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      role="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      android_ripple={{ color: colors.ripple, borderless: true, radius: 36 }}
      style={styles.tab}
    >
      <Animated.View style={[styles.icon, pop]}>
        <TabIcon name={icon} color={color} focused={focused} />
      </Animated.View>
      <Text style={[styles.label, { color }, focused && styles.labelFocused]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(colors => ({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  highlightTrack: { position: 'absolute', top: 6, left: 0, alignItems: 'center' },
  highlight: { width: 56, height: 30, borderRadius: 15, backgroundColor: colors.greenTint },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  icon: { height: 30, justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '600' },
  labelFocused: { fontWeight: '800' },
}));
