// Page scaffolding: the scrolling page, staggered entrances for its sections, and the glass action bar that sits
// at the bottom of step-by-step screens.
import type { ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles } from '@fonzkart/ui';
import { Glass } from './Glass';
import { MAX_CONTENT, radii } from './tokens';

export const PAGE_PADDING = 16;

/** The floating tab bar's height plus its gap; tab screens leave this much room at the bottom. */
export const TAB_BAR_HEIGHT = 64;
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 12) + 16;
}

export function Page({ children, gap = 16, bottom = 32, contentStyle, ...scroll }: ScrollViewProps & {
  children: ReactNode;
  gap?: number;
  /** Extra room at the bottom (tab screens pass useTabBarSpace()). */
  bottom?: number;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.scroll} {...scroll}
      contentContainerStyle={[styles.page, { gap, paddingBottom: bottom }, contentStyle]}>
      {children}
    </ScrollView>
  );
}

/** Fades and lifts a section in, a little after the one before it. */
export function Appear({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.duration(420).delay(60 + index * 70).springify().damping(18)} style={style}>
      {children}
    </Animated.View>
  );
}

/** Buttons fixed to the bottom of the screen on a glass bar. */
export function ActionBar({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Glass strong radius={radii.xl} shadow="lg" style={styles.bar}>{children}</Glass>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { padding: PAGE_PADDING, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' },
  barWrap: { paddingHorizontal: 12, paddingTop: 8, backgroundColor: colors.background },
  bar: { flexDirection: 'row', gap: 10, padding: 8, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' },
}));
