// Fonzkart for business: we buy companies' surplus IT assets and e-waste in bulk, working or scrap, so their
// liquidation managers turn idle stock into cash. Built to be seen more than read: an animated assets → pickup → cash
// flow, who it is for, what we buy, what every deal includes and four steps, then one tap to call, WhatsApp or email
// the team with a ready-made enquiry. Nothing is sent by the app.
import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { makeStyles, useColors } from '@fonzkart/ui';
import { CATEGORY_ART } from '../src/categoryArt/art';
import { ArtBackground } from '../src/categoryArt/motion';
import { BULK_MESSAGE, CONTACT } from '../src/contact';
import { useTileWidth } from '../src/grid';
import { Appear, Button, Icon, Notice, Page, radii, type, useDesign, type IconName } from '../src/design';

const FOR_WHOM: { icon: IconName; label: string }[] = [
  { icon: 'cash', label: 'Liquidation managers' },
  { icon: 'laptop', label: 'IT & admin teams' },
  { icon: 'box', label: 'Procurement' },
  { icon: 'building', label: 'Offices moving out' },
  { icon: 'user', label: 'Schools & colleges' },
  { icon: 'sparkle', label: 'Startups' },
];

const WE_BUY: { icon: IconName; label: string }[] = [
  { icon: 'laptop', label: 'Laptops' },
  { icon: 'monitor', label: 'Desktops' },
  { icon: 'phone', label: 'Phones' },
  { icon: 'tablet', label: 'Tablets' },
  { icon: 'tv', label: 'Monitors & TVs' },
  { icon: 'grid', label: 'Servers & networking' },
  { icon: 'headphones', label: 'Accessories' },
  { icon: 'recycle', label: 'E-waste & scrap' },
];

const INCLUDED: { icon: IconName; title: string; note: string }[] = [
  { icon: 'truck', title: 'Free pickup', note: 'From your premises' },
  { icon: 'lock', title: 'Data wiped', note: 'Every single device' },
  { icon: 'wallet', title: 'Fast payment', note: 'Straight to your account' },
  { icon: 'recycle', title: 'Responsible recycling', note: 'Nothing goes to landfill' },
];

const STEPS: { icon: IconName; title: string }[] = [
  { icon: 'mail', title: 'Share your list' },
  { icon: 'cash', title: 'Get your quote' },
  { icon: 'truck', title: 'We collect' },
  { icon: 'wallet', title: 'You get paid' },
];

/** The drawing's backdrop: the Bulk card's cardboard cream. */
const ART_BACKGROUND = '#fff8eb';
/** Height to width of the category drawings' window. */
const ART_ASPECT = 132 / 150;

export default function BulkForBusiness() {
  const styles = useStyles();
  const d = useDesign();
  const width = useTileWidth(1);
  const [error, setError] = useState('');
  const Art = CATEGORY_ART.bulk;
  const artHeight = Math.round(width * ART_ASPECT * 0.78);

  const open = (url: string) => {
    setError('');
    Linking.openURL(url).catch(() => setError('This phone has no app for that. Use the details below instead.'));
  };
  const subject = encodeURIComponent('Bulk IT asset liquidation');
  const body = encodeURIComponent(BULK_MESSAGE);
  const whatsapp = () => open(`https://wa.me/${CONTACT.whatsapp}?text=${body}`);

  return (
    <Page>
      {/* Hero: the pallet drawing over the promise, with the main action. */}
      <Appear>
        <View style={[styles.hero, { boxShadow: d.shadow.md }]}>
          <View style={[styles.art, { height: artHeight, backgroundColor: ART_BACKGROUND }]}>
            <ArtBackground.Provider value={ART_BACKGROUND}>
              <Art width={width} height={artHeight} />
            </ArtBackground.Provider>
            <View style={styles.forBusiness}><Text style={styles.forBusinessText}>FOR BUSINESSES</Text></View>
          </View>
          <View style={[styles.heroBody, { backgroundImage: d.heroGradient }]}>
            <Text style={styles.heroTitle}>Turn idle IT assets into cash</Text>
            <Text style={styles.heroLine}>Working or scrap, any quantity. We buy it all.</Text>
            <Button title="Get a quote on WhatsApp" icon="chat" onPress={whatsapp} />
          </View>
        </View>
      </Appear>

      {/* Assets → pickup → cash, with a parcel travelling along. */}
      <Appear index={1}>
        <Flow />
      </Appear>

      <Appear index={2}>
        <Text style={styles.section}>Built for</Text>
        <View style={styles.chips}>
          {FOR_WHOM.map(f => (
            <View key={f.label} style={styles.chip}>
              <Icon name={f.icon} color={d.scheme === 'dark' ? '#86efac' : '#15803d'} size={16} filled />
              <Text style={styles.chipText}>{f.label}</Text>
            </View>
          ))}
        </View>
      </Appear>

      <Appear index={3}>
        <Text style={styles.section}>What we buy</Text>
        <View style={styles.buyGrid}>
          {WE_BUY.map(w => (
            <View key={w.label} style={[styles.buy, { boxShadow: d.shadow.sm }]}>
              <View style={styles.buyIcon}><Icon name={w.icon} color="#ffffff" size={22} /></View>
              <Text style={styles.buyLabel} numberOfLines={2}>{w.label}</Text>
            </View>
          ))}
        </View>
      </Appear>

      {/* Working and scrap: both are worth money. */}
      <Appear index={4}>
        <View style={styles.split}>
          <View style={[styles.half, styles.halfWorking]}>
            <Icon name="check" color="#ffffff" size={26} strokeWidth={2.6} />
            <Text style={styles.halfTitle}>Working</Text>
            <Text style={styles.halfNote}>Top resale value</Text>
          </View>
          <View style={[styles.half, styles.halfScrap]}>
            <Icon name="recycle" color="#ffffff" size={26} />
            <Text style={styles.halfTitle}>Dead or scrap</Text>
            <Text style={styles.halfNote}>Recycled, still paid</Text>
          </View>
        </View>
      </Appear>

      <Appear index={5}>
        <Text style={styles.section}>Every deal includes</Text>
        <View style={styles.buyGrid}>
          {INCLUDED.map(i => (
            <View key={i.title} style={[styles.included, { boxShadow: d.shadow.sm }]}>
              <View style={styles.includedIcon}><Icon name={i.icon} color={d.scheme === 'dark' ? '#86efac' : '#15803d'} size={22} filled /></View>
              <Text style={styles.includedTitle}>{i.title}</Text>
              <Text style={styles.includedNote}>{i.note}</Text>
            </View>
          ))}
        </View>
      </Appear>

      <Appear index={6}>
        <Text style={styles.section}>How it works</Text>
        <View style={styles.timeline}>
          {STEPS.map((s, i) => (
            <View key={s.title} style={styles.tStep}>
              <View style={styles.tRail}>
                <View style={[styles.tDot, { boxShadow: d.shadow.green }]}><Icon name={s.icon} color="#ffffff" size={18} filled /></View>
                {i < STEPS.length - 1 ? <View style={styles.tLine} /> : null}
              </View>
              <View style={styles.tText}>
                <Text style={styles.tNo}>STEP {i + 1}</Text>
                <Text style={styles.tTitle}>{s.title}</Text>
              </View>
            </View>
          ))}
        </View>
      </Appear>

      <Appear index={7}>
        <View style={[styles.cta, { backgroundImage: d.heroGradient, boxShadow: d.shadow.md }]}>
          <Text style={styles.ctaTitle}>Talk to our business team</Text>
          <Text style={styles.ctaLine}>{CONTACT.hours}</Text>
          {error ? <Notice tone="error" text={error} /> : null}
          <Button title="WhatsApp us" icon="chat" onPress={whatsapp} />
          <Button title={`Call ${CONTACT.phoneDisplay}`} variant="secondary" icon="phone" onPress={() => open(`tel:${CONTACT.phone}`)} />
          <Button title={`Email ${CONTACT.email}`} variant="secondary" icon="mail"
            onPress={() => open(`mailto:${CONTACT.email}?subject=${subject}&body=${body}`)} />
        </View>
      </Appear>
    </Page>
  );
}

/** Your assets → our pickup → your cash, with a parcel moving along the line. */
function Flow() {
  const styles = useStyles();
  const colors = useColors();
  const d = useDesign();
  const [lineWidth, setLineWidth] = useState(0);
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [t]);
  const parcel = useAnimatedStyle(() => ({
    transform: [{ translateX: t.value * Math.max(0, lineWidth - 18) }],
    opacity: t.value < 0.08 ? t.value / 0.08 : t.value > 0.92 ? (1 - t.value) / 0.08 : 1,
  }));
  const nodes: { icon: IconName; label: string }[] = [
    { icon: 'box', label: 'Your assets' },
    { icon: 'truck', label: 'Our pickup' },
    { icon: 'cash', label: 'Your cash' },
  ];
  return (
    <View style={[styles.flow, { boxShadow: d.shadow.sm }]}>
      <View style={styles.flowTrack} onLayout={e => setLineWidth(e.nativeEvent.layout.width)}>
        <View style={styles.flowLine} />
        <Animated.View style={[styles.parcel, parcel]} />
      </View>
      <View style={styles.flowNodes}>
        {nodes.map((n, i) => (
          <View key={n.label} style={styles.flowNode}>
            <View style={[styles.flowIcon, i === 2 && { backgroundColor: colors.green }]}>
              <Icon name={n.icon} color={i === 2 ? '#ffffff' : colors.green} size={24} filled={i !== 2} />
            </View>
            <Text style={styles.flowLabel}>{n.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  hero: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  art: { alignItems: 'center', justifyContent: 'center' },
  forBusiness: { position: 'absolute', top: 14, left: 14, backgroundColor: '#78350f', borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6 },
  forBusinessText: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: '#fff8eb' },
  heroBody: { padding: 20, gap: 10 },
  heroTitle: { ...type.title, fontSize: 28, lineHeight: 33, color: '#ffffff' },
  heroLine: { ...type.body, fontWeight: '600', color: '#dcfce7', marginBottom: 4 },
  flow: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: 18, paddingHorizontal: 14 },
  flowTrack: { position: 'absolute', top: 18 + 27 - 9, left: '17%', right: '17%', height: 18, justifyContent: 'center' },
  flowLine: { height: 3, borderRadius: 2, backgroundColor: colors.greenBorder },
  parcel: { position: 'absolute', left: 0, width: 18, height: 18, borderRadius: 5, backgroundColor: '#d97706', borderWidth: 2, borderColor: '#fff8eb' },
  flowNodes: { flexDirection: 'row', justifyContent: 'space-between' },
  flowNode: { width: '33%', alignItems: 'center', gap: 8 },
  flowIcon: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.surface,
  },
  flowLabel: { ...type.small, fontWeight: '800', color: colors.navy },
  section: { ...type.heading, fontSize: 19, color: colors.navy, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.greenSoft, borderWidth: 1, borderColor: colors.greenBorder,
    borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 8,
  },
  chipText: { ...type.small, fontWeight: '700', color: colors.navy },
  buyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  buy: {
    flexBasis: '22%', flexGrow: 1, alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 4,
  },
  buyIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  buyLabel: { fontSize: 11.5, lineHeight: 14, fontWeight: '700', color: colors.navy, textAlign: 'center' },
  split: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, borderRadius: radii.lg, padding: 16, gap: 4 },
  halfWorking: { backgroundColor: '#16a34a' },
  halfScrap: { backgroundColor: '#b45309' },
  halfTitle: { ...type.heading, fontSize: 18, color: '#ffffff', marginTop: 6 },
  halfNote: { ...type.small, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  included: {
    flexBasis: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border,
    padding: 14, gap: 3,
  },
  includedIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  includedTitle: { ...type.label, color: colors.navy },
  includedNote: { ...type.small, color: colors.muted },
  timeline: { gap: 0 },
  tStep: { flexDirection: 'row', gap: 14 },
  tRail: { alignItems: 'center', width: 40 },
  tDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  tLine: { width: 3, height: 22, backgroundColor: colors.greenBorder, borderRadius: 2 },
  tText: { paddingTop: 2, gap: 1 },
  tNo: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: colors.green },
  tTitle: { ...type.label, fontSize: 16, color: colors.navy },
  cta: { borderRadius: radii.xl, padding: 20, gap: 10 },
  ctaTitle: { ...type.title, fontSize: 24, lineHeight: 29, color: '#ffffff' },
  ctaLine: { ...type.small, fontWeight: '600', color: '#dcfce7', marginBottom: 4 },
}));
