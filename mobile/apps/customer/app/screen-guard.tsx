// Screen guards: a doorstep service, coming soon. A technician brings the right guard for the customer's exact model
// and fits it at their door. Until it launches this screen shows the service (how it works, the guard kinds) and
// sends the customer to what they can do today. The store and cart code (src/shop) stays for the launch. Every phone
// gets four kinds of guard (tempered glass, Gorilla Glass 5 unbreakable, matte, privacy); "Check your phone" lists them
// for the customer's model. The website's page (components/shop/ScreenGuardSoon.tsx) matches it.
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { guardKind, guardsByModel, useScreenGuardStore } from '@fonzkart/api';
import { makeStyles, useColors } from '@fonzkart/ui';
import { CATEGORY_ART } from '../src/categoryArt/art';
import { ArtBackground, useLoop } from '../src/categoryArt/motion';
import { Appear, Button, Icon, Page, radii, SearchBar, type, useDesign, type IconName } from '../src/design';
import { useTileWidth } from '../src/grid';

const STEPS: { icon: IconName; title: string }[] = [
  { icon: 'clock', title: 'Book a slot' },
  { icon: 'truck', title: 'We come to you' },
  { icon: 'shield', title: 'Fitted on the spot' },
];

const KIND_ICON: Record<string, IconName> = {
  tempered: 'shield', unbreakable: 'bolt', matte: 'sun', privacy: 'lock', clear: 'sparkle', full: 'phone', lens: 'camera',
};

/** The kinds every phone gets. */
const MAIN_KINDS = ['unbreakable', 'tempered', 'matte', 'privacy'];

const PROMISES: { icon: IconName; text: string }[] = [
  { icon: 'truck', text: 'Fitted at your doorstep' },
  { icon: 'shield', text: 'Unbreakable Gorilla Glass 5 guards' },
  { icon: 'check', text: 'Exact fit for your model' },
  { icon: 'sparkle', text: 'Bubble-free fitting' },
  { icon: 'cash', text: 'Pay after fitting' },
];

const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

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
        <Text style={styles.section}>Four kinds for every phone</Text>
        <View style={styles.grid}>
          {MAIN_KINDS.map(guardKind).map(k => {
            const star = k.id === 'unbreakable';
            return (
              <View key={k.id} style={[styles.guard, star && styles.guardStar, { boxShadow: d.shadow.sm }]}>
                {star ? <View style={styles.toughest}><Text style={styles.toughestText}>TOUGHEST</Text></View> : null}
                <View style={[styles.guardIcon, star && styles.guardIconStar]}>
                  <Icon name={KIND_ICON[k.id] ?? 'shield'} color={star ? '#052e16' : colors.greenDark} size={22} filled />
                </View>
                <Text style={[styles.guardTitle, star && styles.white]}>{k.title}</Text>
                <Text style={[styles.guardNote, star && styles.starNote]}>{k.note}</Text>
              </View>
            );
          })}
        </View>
      </Appear>

      <Appear index={3}>
        <GuardFinder />
      </Appear>

      <Appear index={4} style={styles.footer}>
        <Text style={styles.meanwhile}>Launching soon. Meanwhile:</Text>
        <Button title="Sell a device" icon="sell" onPress={() => router.navigate('/')} />
        <Button title="Book a repair" variant="secondary" icon="repair" onPress={() => router.navigate('/repair')} />
      </Appear>
    </Page>
  );
}

/** "Check your phone": search a model and see every kind of guard made for it. Hidden until the list loads. */
function GuardFinder() {
  const styles = useStyles();
  const colors = useColors();
  const store = useScreenGuardStore();
  const models = useMemo(() => guardsByModel(store.data?.items ?? []), [store.data]);
  const [query, setQuery] = useState('');
  if (!models.length) return null;
  const words = normal(query);
  const matches = words ? models.filter(m => normal(`${m.brand} ${m.model}`).includes(words)) : models;
  const shown = matches.slice(0, 5);
  return (
    <View style={styles.finder}>
      <Text style={styles.section}>Check your phone</Text>
      <Text style={styles.finderNote}>{models.length} phones covered. Prices when we launch.</Text>
      <SearchBar value={query} onChangeText={setQuery} placeholder="Type your phone, e.g. iPhone 16 Pro" />
      {shown.length ? shown.map(m => (
        <View key={`${m.brand}|${m.model}`} style={styles.model}>
          <Text style={styles.modelBrand}>{m.brand.toUpperCase()}</Text>
          <Text style={styles.modelName}>{m.model}</Text>
          <View style={styles.kinds}>
            {m.guards.map(g => {
              const kind = guardKind(g.guardType);
              const star = kind.id === 'unbreakable';
              return (
                <View key={g.id} style={[styles.kind, star && styles.kindStar]}>
                  <Icon name={KIND_ICON[kind.id] ?? 'shield'} color={star ? '#bef264' : colors.greenDark} size={12} filled />
                  <Text style={[styles.kindText, star && styles.kindTextStar]}>{star ? 'Unbreakable · Gorilla Glass 5' : kind.title}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )) : (
        <Text style={styles.none}>{"Not on the list yet. Tell us when we launch and we'll bring the right guard."}</Text>
      )}
      {matches.length > shown.length ? <Text style={styles.finderNote}>{matches.length - shown.length} more phones. Type your model to find it.</Text> : null}
    </View>
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
  guardStar: { backgroundColor: '#052e16', borderColor: '#166534' },
  guardIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  guardIconStar: { backgroundColor: '#bef264' },
  toughest: { position: 'absolute', top: 12, right: 12, backgroundColor: '#bef264', borderRadius: radii.pill, paddingHorizontal: 7, paddingVertical: 2 },
  toughestText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6, color: '#052e16' },
  guardTitle: { ...type.label, color: colors.navy },
  white: { color: '#ffffff' },
  guardNote: { ...type.small, color: colors.muted },
  starNote: { color: '#d1fae5' },
  finder: { gap: 10 },
  finderNote: { ...type.small, color: colors.muted, marginTop: -6 },
  model: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 2 },
  modelBrand: { ...type.tiny, fontWeight: '800', letterSpacing: 0.8, color: colors.muted },
  modelName: { ...type.label, color: colors.navy },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.greenTint },
  kindStar: { backgroundColor: '#052e16' },
  kindText: { fontSize: 12, fontWeight: '700', color: colors.greenDark },
  kindTextStar: { color: '#bef264' },
  none: { ...type.small, fontWeight: '600', color: colors.navy, backgroundColor: colors.surface, borderRadius: radii.lg, padding: 14 },
  footer: { gap: 10 },
  meanwhile: { ...type.small, fontWeight: '700', color: colors.muted, textAlign: 'center' },
}));
