// Screen guards: a doorstep service, coming soon. A technician brings the right guard for the customer's exact model
// and fits it at their door. Until it launches this screen shows the service (how it works, the guard types) and
// sends the customer to what they can do today. The store and cart code (src/shop) stays for the launch.
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { makeStyles, useColors } from '@fonzkart/ui';
import { CATEGORY_ART } from '../src/categoryArt/art';
import { ArtBackground, useLoop } from '../src/categoryArt/motion';
import { Appear, Button, Icon, Page, radii, type, useDesign, type IconName } from '../src/design';
import { useTileWidth } from '../src/grid';

const STEPS: { icon: IconName; title: string }[] = [
  { icon: 'clock', title: 'Book a slot' },
  { icon: 'truck', title: 'We come to you' },
  { icon: 'shield', title: 'Fitted on the spot' },
];

const GUARDS: { icon: IconName; title: string; note: string }[] = [
  { icon: 'shield', title: 'Tempered glass', note: 'Everyday armour' },
  { icon: 'lock', title: 'Privacy', note: 'Side views blocked' },
  { icon: 'sun', title: 'Matte', note: 'No glare, no prints' },
  { icon: 'camera', title: 'Camera lens', note: 'Lens protected' },
];

const PROMISES: { icon: IconName; text: string }[] = [
  { icon: 'check', text: 'Exact fit for your model' },
  { icon: 'sparkle', text: 'Bubble-free fitting' },
  { icon: 'cash', text: 'Pay after fitting' },
];

/** The drawing's backdrop: the Screen Guard card's light teal. */
const ART_BACKGROUND = '#f0fdfa';
const ART_ASPECT = 132 / 150;

export default function ScreenGuardSoon() {
  const styles = useStyles();
  const d = useDesign();
  const colors = useColors();
  const router = useRouter();
  const width = useTileWidth(1);
  const Art = CATEGORY_ART.screenguard;
  const artHeight = Math.round(width * ART_ASPECT * 0.8);
  const pulse = useLoop(1.6);
  const glow = useAnimatedStyle(() => ({ opacity: 0.55 + 0.45 * pulse.value, transform: [{ scale: 1 + 0.06 * pulse.value }] }));

  return (
    <Page>
      <Appear>
        <View style={[styles.hero, { boxShadow: d.shadow.md }]}>
          <View style={[styles.art, { height: artHeight, backgroundColor: ART_BACKGROUND }]}>
            <ArtBackground.Provider value={ART_BACKGROUND}>
              <Art width={width} height={artHeight} />
            </ArtBackground.Provider>
            <Animated.View style={[styles.soon, glow]}>
              <Text style={styles.soonText}>COMING SOON</Text>
            </Animated.View>
          </View>
          <View style={[styles.heroText, { backgroundImage: d.heroGradient }]}>
            <Text style={styles.kicker}>Doorstep service</Text>
            <Text style={styles.title}>Screen guards, fitted at your door</Text>
            <View style={styles.promises}>
              {PROMISES.map(p => (
                <View key={p.text} style={styles.promise}>
                  <Icon name={p.icon} color="#bbf7d0" size={15} strokeWidth={2.6} />
                  <Text style={styles.promiseText}>{p.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Appear>

      <Appear index={1}>
        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View key={s.title} style={styles.stepWrap}>
              <View style={styles.step}>
                <View style={[styles.stepIcon, { boxShadow: d.shadow.green }]}>
                  <Icon name={s.icon} color="#ffffff" size={22} filled />
                </View>
                <Text style={styles.stepNo}>{i + 1}</Text>
                <Text style={styles.stepTitle}>{s.title}</Text>
              </View>
              {i < STEPS.length - 1 ? <Icon name="chevronRight" color={colors.greenBorder} size={18} /> : null}
            </View>
          ))}
        </View>
      </Appear>

      <Appear index={2}>
        <Text style={styles.section}>Guards we'll carry</Text>
        <View style={styles.grid}>
          {GUARDS.map(g => (
            <View key={g.title} style={[styles.guard, { boxShadow: d.shadow.sm }]}>
              <View style={styles.guardIcon}><Icon name={g.icon} color={colors.greenDark} size={22} filled /></View>
              <Text style={styles.guardTitle}>{g.title}</Text>
              <Text style={styles.guardNote}>{g.note}</Text>
            </View>
          ))}
        </View>
      </Appear>

      <Appear index={3} style={styles.footer}>
        <Text style={styles.meanwhile}>Launching soon. Meanwhile:</Text>
        <Button title="Sell a device" icon="sell" onPress={() => router.navigate('/')} />
        <Button title="Book a repair" variant="secondary" icon="repair" onPress={() => router.navigate('/repair')} />
      </Appear>
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  hero: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  art: { alignItems: 'center', justifyContent: 'center' },
  soon: {
    position: 'absolute', top: 14, right: 14, backgroundColor: colors.green, borderRadius: radii.pill,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  soonText: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: '#ffffff' },
  heroText: { padding: 20, gap: 6 },
  kicker: { ...type.tiny, textTransform: 'uppercase', color: '#bbf7d0', letterSpacing: 1 },
  title: { ...type.title, fontSize: 26, lineHeight: 31, color: '#ffffff' },
  promises: { gap: 6, marginTop: 6 },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promiseText: { ...type.small, fontWeight: '600', color: '#ffffff' },
  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  stepNo: { ...type.tiny, fontWeight: '900', color: colors.green },
  stepTitle: { ...type.small, fontWeight: '700', color: colors.navy, textAlign: 'center' },
  section: { ...type.heading, fontSize: 18, color: colors.navy, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  guard: {
    flexBasis: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border,
    padding: 14, gap: 4,
  },
  guardIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  guardTitle: { ...type.label, color: colors.navy },
  guardNote: { ...type.small, color: colors.muted },
  footer: { gap: 10 },
  meanwhile: { ...type.small, fontWeight: '700', color: colors.muted, textAlign: 'center' },
}));
