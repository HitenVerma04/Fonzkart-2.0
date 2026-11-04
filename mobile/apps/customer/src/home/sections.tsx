// Home screen sections: the category tab row under the search bar (Blinkit's), the repair & services tiles (Cashify's "Others"), and the dark Fonzkart
// promise card (CRED's style).
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { makeStyles, useColors } from '@fonzkart/ui';
import { Icon, radii, Tap, type, type IconName, useDesign } from '../design';
import { CONTACT } from '../contact';

// ---- Category tabs (on the green header) ----

const TABS: { id: string | null; label: string; icon: IconName }[] = [
  { id: null, label: 'All', icon: 'grid' },
  { id: 'smartphone', label: 'Phones', icon: 'auto' },
  { id: 'laptop', label: 'Laptops', icon: 'laptop' },
  { id: 'tablet', label: 'Tablets', icon: 'tablet' },
  { id: 'watch', label: 'Watches', icon: 'watch' },
  { id: 'smarttv', label: 'TVs', icon: 'tv' },
  { id: 'console', label: 'Consoles', icon: 'gamepad' },
  { id: 'earbuds', label: 'Earbuds', icon: 'headphones' },
  { id: 'camera', label: 'Cameras', icon: 'camera' },
];

export function CategoryTabs() {
  const styles = useStyles();
  const router = useRouter();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
      {TABS.map(t => {
        const on = t.id === null;
        return (
          <Tap key={t.label} scaleTo={0.9} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label}
            onPress={() => (t.id ? router.push({ pathname: '/category/[id]', params: { id: t.id } }) : undefined)} style={styles.tab}>
            <Icon name={t.icon} color="#ffffff" size={22} filled={on} strokeWidth={on ? 2 : 1.6} />
            <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{t.label}</Text>
            <View style={[styles.tabBar, on && styles.tabBarOn]} />
          </Tap>
        );
      })}
    </ScrollView>
  );
}

// ---- Repair & services tiles ----

type Service = { label: string; icon: IconName; to: 'repair' | 'screen-guard' | 'bulk' | 'call' };
const SERVICES: Service[] = [
  { label: 'Repair phone', icon: 'repair', to: 'repair' },
  { label: 'Repair laptop', icon: 'laptop', to: 'repair' },
  { label: 'Screen guard', icon: 'shield', to: 'screen-guard' },
  { label: 'Recycle', icon: 'recycle', to: 'bulk' },
];

export function ServiceTiles({ width }: { width: number }) {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const go = (s: Service) => {
    if (s.to === 'repair') router.navigate('/repair');
    else if (s.to === 'screen-guard') router.push('/screen-guard');
    else if (s.to === 'bulk') router.push('/bulk');
  };
  return (
    <View style={styles.services}>
      {SERVICES.map(s => (
        <Tap key={s.label} scaleTo={0.92} accessibilityRole="button" accessibilityLabel={s.label} onPress={() => go(s)} style={[styles.service, { width }]}>
          <View style={[styles.serviceIcon, { width, height: width * 0.86 }]}>
            <Icon name={s.icon} color={colors.greenDark} size={width * 0.38} filled />
          </View>
          <Text style={styles.serviceLabel} numberOfLines={2}>{s.label}</Text>
        </Tap>
      ))}
    </View>
  );
}

// ---- The Fonzkart promise (dark card) ----

const PROMISES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'bolt', title: 'Paid on the spot', text: 'Cash, UPI or bank transfer at pickup' },
  { icon: 'truck', title: 'Free doorstep pickup', text: 'Pick a time; we come to you' },
  { icon: 'lock', title: 'Your data, wiped', text: 'Certified wipe on every device' },
];
const STEPS = ['Get your price', 'Book a free pickup', 'Get paid instantly'];

export function PromiseCard() {
  const styles = useStyles();
  const d = useDesign();
  return (
    <View style={styles.promise}>
      <View style={styles.promiseGlow} />
      <Text style={styles.promiseKicker}>The Fonzkart promise</Text>
      <Text style={styles.promiseTitle}>Sell in 3 steps.{'\n'}Get paid the same day.</Text>
      <View style={styles.steps}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.step}>
            <Text style={[styles.stepNumber, { color: d.deepAccent }]}>{i + 1}</Text>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}
      </View>
      <View style={styles.divider} />
      {PROMISES.map(p => (
        <View key={p.title} style={styles.promiseRow}>
          <View style={styles.promiseIcon}>
            <Icon name={p.icon} color={d.deepAccent} size={18} filled />
          </View>
          <View style={styles.promiseText}>
            <Text style={styles.promiseRowTitle}>{p.title}</Text>
            <Text style={styles.promiseRowText}>{p.text}</Text>
          </View>
        </View>
      ))}
      <Text style={styles.promiseFoot}>Questions? Call {CONTACT.phoneDisplay} · {CONTACT.hours}</Text>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  tabs: { flexDirection: 'row', gap: 2, paddingRight: 8 },
  tab: { alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingTop: 4, minWidth: 58 },
  tabLabel: { ...type.small, fontSize: 12, color: 'rgba(255,255,255,0.82)', fontWeight: '600' },
  tabLabelOn: { color: '#ffffff', fontWeight: '800' },
  tabBar: { height: 3, width: '80%', borderRadius: 2, backgroundColor: 'transparent', marginTop: 2 },
  tabBarOn: { backgroundColor: '#ffffff' },
  services: { flexDirection: 'row', justifyContent: 'space-between' },
  service: { alignItems: 'center', gap: 6 },
  serviceIcon: { borderRadius: radii.md, backgroundColor: colors.greenSoft, borderWidth: 1, borderColor: colors.greenBorder, alignItems: 'center', justifyContent: 'center' },
  serviceLabel: { ...type.small, fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center' },
  promise: { borderRadius: radii.xl, padding: 20, gap: 12, backgroundColor: '#07120c', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(74,222,128,0.18)' },
  promiseGlow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -90, top: -120, backgroundImage: 'linear-gradient(200deg, rgba(34,197,94,0.35) 0%, rgba(34,197,94,0) 60%)' },
  promiseKicker: { ...type.tiny, textTransform: 'uppercase', color: '#4ade80' },
  promiseTitle: { ...type.title, fontSize: 22, lineHeight: 28, color: '#f0fdf4' },
  steps: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, gap: 6, borderRadius: radii.md, padding: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  stepNumber: { fontSize: 20, fontWeight: '900', color: '#4ade80' },
  stepText: { ...type.small, fontSize: 12, fontWeight: '700', color: '#dcfce7' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 2 },
  promiseRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  promiseIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(74,222,128,0.12)', alignItems: 'center', justifyContent: 'center' },
  promiseText: { flex: 1, gap: 1 },
  promiseRowTitle: { ...type.label, fontSize: 14, color: '#f0fdf4' },
  promiseRowText: { ...type.small, fontSize: 12, color: 'rgba(220,252,231,0.7)' },
  promiseFoot: { ...type.small, fontSize: 11, color: 'rgba(220,252,231,0.55)', marginTop: 4 },
}));
