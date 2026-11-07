// Home's "Pick up where you left off" card: shown while a device valuation is saved part-way (sellProgress.ts), after
// going back to Home or reopening the app. Tapping it reopens the step the customer had reached, with the device,
// variant and answers put back; the × forgets it.
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { categoryName } from '@fonzkart/core';
import { makeStyles, useColors } from '@fonzkart/ui';
import { Appear, deviceKindOf, Icon, ProductImage, radii, Tap, type, useDesign } from '../design';
import { restoreQuote } from '../quoteDraft';
import { clearSellProgress, progressFraction, progressText, useSellProgress, type SellProgress } from '../sellProgress';

function open(router: ReturnType<typeof useRouter>, p: SellProgress) {
  switch (p.stage) {
    case 'models':
      if (!p.brandId) break;
      router.push({ pathname: '/brand/[id]', params: { id: p.brandId, category: p.category, ...(p.brandName ? { name: p.brandName } : {}) } });
      return;
    case 'variants':
      if (!p.modelId) break;
      router.push({ pathname: '/model/[id]', params: { id: p.modelId, name: p.modelName ?? '', img: p.img ?? '', category: p.category } });
      return;
    case 'questions':
    case 'offer':
      if (!p.draft) break;
      restoreQuote(p.draft);
      router.push(p.stage === 'offer' && p.draft.answers ? '/quote/offer' : '/quote/questions');
      return;
  }
  clearSellProgress(); // saved by an older app version without what this step needs
}

export function ResumeCard() {
  const styles = useStyles();
  const colors = useColors();
  const d = useDesign();
  const router = useRouter();
  const progress = useSellProgress();
  if (!progress) return null;

  const label = categoryName(progress.category) ?? 'Your device';
  const { device, next } = progressText(progress, label);
  const percent = Math.round(progressFraction(progress) * 100);
  const img = progress.draft?.img || progress.img;
  const kind = deviceKindOf(progress.draft?.category ?? progress.category);

  return (
    <Appear>
    <View style={[styles.card, { boxShadow: d.shadow.md }]}>
      <Tap onPress={() => open(router, progress)} scaleTo={0.97} style={styles.main}
        accessibilityRole="button" accessibilityLabel={`Pick up where you left off: ${device}. ${next}.`}>
        <View style={styles.image}>
          {img ? <ProductImage uri={img} label={device} size={52} kind={kind} /> : <Icon name="sell" color={colors.green} size={28} />}
        </View>
        <View style={styles.text}>
          <View style={styles.kickerRow}>
            <Icon name="clock" color={colors.green} size={13} />
            <Text style={styles.kicker} numberOfLines={1}>Pick up where you left off</Text>
          </View>
          <Text style={styles.device} numberOfLines={1}>{device}</Text>
          <Text style={styles.next} numberOfLines={1}>{next}</Text>
          <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[styles.fill, { width: `${percent}%`, backgroundImage: d.greenGradient }]} />
          </View>
        </View>
        <View style={[styles.go, { backgroundImage: d.greenGradient }]}>
          <Icon name="chevronRight" color="#ffffff" size={20} strokeWidth={2.6} />
        </View>
      </Tap>
      <Tap onPress={clearSellProgress} scaleTo={0.85} hitSlop={10} style={styles.close}
        accessibilityRole="button" accessibilityLabel="Forget this device">
        <Icon name="close" color={colors.muted} size={14} strokeWidth={2.4} />
      </Tap>
    </View>
    </Appear>
  );
}

const useStyles = makeStyles(colors => ({
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
  main: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingRight: 14 },
  image: {
    width: 64, height: 64, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kicker: { ...type.small, fontSize: 12, fontWeight: '800', color: colors.green, flexShrink: 1 },
  device: { ...type.label, fontSize: 15, color: colors.navy },
  next: { ...type.small, color: colors.muted },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.placeholder, overflow: 'hidden', marginTop: 6 },
  fill: { height: 5, borderRadius: 3 },
  go: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  close: {
    position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
}));
