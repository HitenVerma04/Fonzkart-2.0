// The header of every pushed screen: a round glass back button, a bold title, and room for one action. It sits on
// the page colour, so screens read as one surface.
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackHeaderProps } from 'expo-router';
import { makeStyles, useColors } from '@fonzkart/ui';
import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';
import { Tap } from './Tap';
import { MAX_CONTENT, radii, type } from './tokens';

export function AppHeader({ navigation, options, back }: NativeStackHeaderProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const title = typeof options.headerTitle === 'string' ? options.headerTitle : options.title ?? '';
  const right = options.headerRight?.({ canGoBack: !!back, tintColor: undefined });
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
      <View style={styles.row}>
        {back ? <IconButton icon="back" label="Back" onPress={() => navigation.goBack()} /> : <View style={styles.spacer} />}
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
        {right ? <View style={styles.right}>{right as ReactNode}</View> : <View style={styles.spacer} />}
      </View>
    </View>
  );
}

/** The big title at the top of a tab (My orders, Profile...), with an optional line under it and actions. */
export function TabTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabTitle, { paddingTop: insets.top + 14 }]}>
      <View style={styles.tabTitleText}>
        <Text style={styles.big} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** A round glass button with one icon (back, close, notifications). */
export function IconButton({ icon, label, onPress, badge, tint }: {
  icon: IconName;
  label: string;
  onPress: () => void;
  badge?: boolean;
  /** For use on the green home header. */
  tint?: 'onGreen';
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Tap onPress={onPress} scaleTo={0.9} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}>
      {tint ? (
        <View style={styles.onGreen}>
          <Icon name={icon} color={colors.white} size={21} />
          {badge ? <View style={[styles.badge, styles.badgeOnGreen]} /> : null}
        </View>
      ) : (
        <Glass strong radius={radii.pill} shadow="sm" style={styles.button}>
          <Icon name={icon} color={colors.navy} size={21} strokeWidth={2.2} />
          {badge ? <View style={styles.badge} /> : null}
        </Glass>
      )}
    </Tap>
  );
}

const useStyles = makeStyles(colors => ({
  wrap: { backgroundColor: colors.background, paddingBottom: 8, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', maxWidth: MAX_CONTENT + 8, alignSelf: 'center', minHeight: 44 },
  // the iOS navigation bar: 17-pt semibold title, 44-pt round buttons
  title: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.4, color: colors.navy, textAlign: 'center' },
  spacer: { width: 44 },
  right: { minWidth: 44, alignItems: 'flex-end' },
  tabTitle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' },
  tabTitleText: { flex: 1, gap: 2 },
  big: { ...type.display, color: colors.navy },
  subtitle: { ...type.small, color: colors.muted },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  onGreen: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  badge: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.green, borderWidth: 2, borderColor: colors.surface },
  badgeOnGreen: { backgroundColor: '#bbf7d0', borderColor: '#16a34a' },
}));
