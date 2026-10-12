import { StyleSheet, Text, View } from 'react-native';
import { Logo } from './Logo';
import { colors, font, radius, spacing } from './theme';

/** Welcome screen of an app whose features are still being built (Partner, Admin). Says only what is true today. */
export function AppShell({ appName, comingNext, serverOnline }: {
  appName: string;
  comingNext: string[];
  serverOnline: boolean | undefined;
}) {
  const status = serverOnline === undefined ? 'Checking server…' : serverOnline ? 'Server online' : 'Server unreachable';
  return (
    <View style={styles.page}>
      <Logo variant="stacked" height={150} />
      <Text style={styles.appName}>{appName}</Text>
      <View style={[styles.badge, serverOnline === false && styles.badgeOff]}>
        <View style={[styles.dot, { backgroundColor: serverOnline === false ? colors.danger : colors.green }]} />
        <Text style={styles.badgeText}>{status}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Being built</Text>
        {comingNext.map(item => (
          <Text key={item} style={styles.item}>•  {item}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background, gap: spacing.lg },
  appName: { fontSize: font.title, fontWeight: '800', color: colors.navy },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.greenSoft, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  badgeOff: { backgroundColor: '#fef2f2' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontSize: font.small, color: colors.textSoft, fontWeight: '600' },
  card: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  cardTitle: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  item: { fontSize: font.body, color: colors.textSoft },
});
