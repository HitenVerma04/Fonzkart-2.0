// The Customer app's bottom tabs (Home, Buy, Sell, Repair, Orders): a floating glass bar with rounded corners. A soft
// green tile slides behind the chosen tab, whose icon fills in, lifts and pops; presses also ripple in green on
// Android. Profile is a tab route too, but it opens from the home header, so it has no button here.
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { makeStyles, useColors } from '@fonzkart/ui';
import { Glass, Icon, motion, TAB_BAR_HEIGHT, Tap, type IconName } from '../design';
import { launchTarget } from '../launchTargets';

/** Route name → icon. Routes not listed get the Home icon. */
const ICONS: Record<string, IconName> = { index: 'home', buy: 'buy', sell: 'sell', repair: 'repair', orders: 'orders' };
/** Tab routes without a button in the bar. */
const HIDDEN = new Set(['profile']);
const PAD = 6;
const TILE = 62;

export function FonzkartTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const routes = state.routes.filter(r => !HIDDEN.has(r.name));
  const active = routes.findIndex(r => r.key === state.routes[state.index]?.key);
  const tabWidth = (width - PAD * 2) / routes.length;
  const tile = Math.min(TILE, tabWidth - 4);
  const x = useSharedValue(0);
  const shown = useSharedValue(0);
  const placed = useSharedValue(false);

  useEffect(() => {
    if (!tabWidth) return;
    shown.value = withTiming(active < 0 ? 0 : 1, { duration: 160 });
    if (active < 0) return;
    const to = active * tabWidth + (tabWidth - tile) / 2;
    // The first placement jumps; later ones spring.
    x.value = placed.value ? withSpring(to, motion.snappy) : to;
    placed.value = true;
  }, [active, tabWidth, tile, x, shown, placed]);

  const tileStyle = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateX: x.value }] }));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Glass strong radius={26} shadow="lg" style={styles.bar} onLayout={e => setWidth(e.nativeEvent.layout.width)} role="tablist">
        {tabWidth ? <Animated.View pointerEvents="none" style={[styles.tile, { width: tile }, tileStyle]} /> : null}
        {routes.map((route, index) => {
          const focused = index === active;
          const { options } = descriptors[route.key]!;
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          const icon = ICONS[route.name] ?? 'home';
          return (
            <Tab key={route.key} label={label} icon={icon} target={icon} focused={focused} onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })} />
          );
        })}
      </Glass>
    </View>
  );
}

function Tab({ label, icon, target, focused, onPress, onLongPress }: {
  label: string;
  icon: IconName;
  /** Which launch-animation icon lands here. */
  target: string;
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
    if (focused) scale.value = withSequence(withTiming(1.08, { duration: 110 }), withSpring(1, motion.press));
  }, [focused, scale, lift]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -1 * lift.value }, { scale: scale.value }] }));
  const color = focused ? colors.green : colors.textSoft;

  return (
    <Tap
      onPress={onPress}
      onLongPress={onLongPress}
      scaleTo={0.9}
      role="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      android_ripple={{ color: colors.ripple, borderless: true, radius: 32 }}
      style={styles.tab}
    >
      <View ref={launchTarget(target)} collapsable={false}>
        <Animated.View style={iconStyle}>
          <Icon name={icon} color={color} size={24} filled={focused} strokeWidth={focused ? 2.1 : 1.7} />
        </Animated.View>
      </View>
      <Text style={[styles.label, { color }, focused && styles.labelFocused]} numberOfLines={1}>{label}</Text>
    </Tap>
  );
}

const useStyles = makeStyles(colors => ({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, alignItems: 'center' },
  bar: { flexDirection: 'row', height: TAB_BAR_HEIGHT, padding: PAD, width: '100%', maxWidth: 520 },
  // the soft green tile behind the chosen tab
  tile: {
    position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: 18,
    backgroundColor: colors.greenTint, borderWidth: 1, borderColor: colors.greenBorder, boxShadow: `0 4px 14px ${colors.ripple}`,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 11, lineHeight: 13, fontWeight: '500', letterSpacing: 0.1 },
  labelFocused: { fontWeight: '700' },
}));
