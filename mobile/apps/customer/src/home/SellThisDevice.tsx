// "Sell this device" (as in Cashify): the phone or tablet the app runs on, by name with its photo and price. It always
// appears on a phone or tablet, as specific as the system lets it be: the exact model ("Sell iPhone XR"), else the
// maker ("Sell this Samsung phone", with its logo), else just "Sell this phone". When the model and its variant are
// known, tapping goes straight to the questions about the device's condition; otherwise it opens the variants, the
// maker's models, or the whole category. Only the web build has no device to show.
import { useMemo } from 'react';
import { Image, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useBrands, useModelSearch, useVariants } from '@fonzkart/api';
import { formatInr, imageUrl, modelImage, sellCategoryOf } from '@fonzkart/core';
import { makeStyles } from '@fonzkart/ui';
import { lerp, useLoop } from '../categoryArt/motion';
import { deviceKindOf, Icon, ProductImage, radii, Tap, type } from '../design';
import { startQuote } from '../quoteDraft';
import { deviceTitle, matchBrand, matchModel, matchVariant, readDeviceSpecs, searchNames } from './thisDevice';

const STAGE_WIDTH = 108;
const STAGE_HEIGHT = 128;

export function SellThisDevice() {
  const styles = useStyles();
  const router = useRouter();
  const specs = useMemo(readDeviceSpecs, []);
  const names = specs ? searchNames(specs) : [];
  const isTablet = !!specs?.isTablet;
  const expected = isTablet ? 'tablet' : 'smartphone';

  // Up to three names to look the device up by (a fixed number of searches, as hooks must be).
  const first = useModelSearch(names[0] ?? '');
  const second = useModelSearch(names[1] ?? '');
  const third = useModelSearch(names[2] ?? '');
  const searches = [first, second, third];
  const match = names.map((n, i) => matchModel(searches[i]!.data, n, isTablet)).find(Boolean);
  const searching = names.some((_, i) => searches[i]!.isPending);
  const variants = useVariants(match?.id);
  const brands = useBrands(expected);
  const brand = specs ? matchBrand(brands.data, specs) : undefined;
  const variant = specs ? matchVariant(variants.data, specs) : undefined;

  if (!specs) return null;

  const category = match ? sellCategoryOf(match.category) : expected;
  const word = category === 'tablet' ? 'tablet' : 'phone';
  const img = match ? modelImage(match.img, category) : null;
  const best = variant?.basePrice ?? (variants.data?.length ? Math.max(...variants.data.map(v => v.basePrice)) : undefined);
  const title = match?.name ?? deviceTitle(specs) ?? (brand ? `this ${brand.name} ${word}` : `this ${word}`);
  const specLine = [
    specs.ramGb ? `${specs.ramGb} GB RAM` : null,
    specs.storageGb ? (specs.storageGb >= 1024 ? `${specs.storageGb / 1024} TB` : `${specs.storageGb} GB`) : null,
    specs.osVersion ? `${specs.osName} ${specs.osVersion}` : null,
  ].filter(Boolean) as string[];

  // The variant the questions are about: this device's, or the model's only one.
  const only = variants.data?.length === 1 && variants.data[0]!.basePrice > 0 ? variants.data[0] : undefined;
  const chosen = variant ?? only;

  const open = () => {
    if (match && chosen) {
      startQuote({
        modelId: match.id, modelName: match.name, img: img ?? '', variantId: chosen.id, variantName: chosen.name, basePrice: chosen.basePrice, category,
      });
      router.push('/quote/questions');
    } else if (match) {
      router.push({
        pathname: '/model/[id]',
        params: { id: match.id, name: match.name, img: img ?? '', category },
      });
    } else if (brand) {
      router.push({ pathname: '/brand/[id]', params: { id: brand.id, category, name: brand.name } });
    } else {
      router.push({ pathname: '/category/[id]', params: { id: category } });
    }
  };

  const worth = best ? null : match || searching ? 'Finding your best price…' : 'See what it is worth in 60 seconds';
  return (
    <Tap onPress={open} scaleTo={0.98} accessibilityRole="button"
      accessibilityLabel={`Sell ${title}${best ? `, get up to ${formatInr(best)}` : ''}${specLine.length ? `, ${specLine.join(', ')}` : ''}`}
      style={styles.card}>
      <View style={styles.glow} />
      <View style={styles.top}>
        <View style={styles.text}>
          <View style={styles.kickerRow}>
            <LiveDot />
            <Text style={styles.kicker}>You're holding</Text>
          </View>
          <Text style={styles.title} numberOfLines={3}>Sell {title}</Text>
          {variant ? <Text style={styles.variant} numberOfLines={1}>{variant.name}</Text> : null}
          {best ? (
            <View style={styles.priceBlock}>
              <Text style={styles.upTo}>Get up to</Text>
              <Text style={styles.price}>{formatInr(best)}</Text>
            </View>
          ) : (
            <Text style={styles.worth}>{worth}</Text>
          )}
        </View>
        <Stage>
          {img ? (
            <ProductImage uri={img} label={match?.name ?? title} size={STAGE_WIDTH + 4} kind={deviceKindOf(category)} />
          ) : brand ? (
            <Image source={{ uri: imageUrl(brand.logo) ?? undefined }} style={styles.logo} resizeMode="contain" accessibilityLabel={brand.name} />
          ) : (
            <Icon name={category === 'tablet' ? 'tablet' : 'auto'} color="#16a34a" size={52} filled />
          )}
        </Stage>
      </View>
      <View style={styles.bottom}>
        <View style={styles.specs}>
          {specLine.map(s => (
            <View key={s} style={styles.spec}>
              <Text style={styles.specText} numberOfLines={1}>{s}</Text>
            </View>
          ))}
        </View>
        <View style={styles.button}>
          <Text style={styles.buttonText}>Sell now</Text>
          <Icon name="chevronRight" color="#0f3a24" size={16} strokeWidth={2.8} />
        </View>
      </View>
    </Tap>
  );
}

/** The device on a white stage that floats gently, with a ring spreading behind it and a scanner beam passing over it. */
function Stage({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const float = useLoop(4.4, 0, 'motion');
  const ring = useLoop(2.6, 0, 'motion');
  const scan = useLoop(3.2, 0.4, 'motion');
  const stage = useAnimatedStyle(() => ({ transform: [{ translateY: lerp(-3, 3, float.value) }] }));
  const wave = useAnimatedStyle(() => ({ opacity: lerp(0.32, 0, ring.value), transform: [{ scale: lerp(1, 1.26, ring.value) }] }));
  const beam = useAnimatedStyle(() => ({ transform: [{ translateY: lerp(-20, STAGE_HEIGHT - 14, scan.value) }] }));
  return (
    <View style={styles.stageWrap}>
      <Animated.View style={[styles.wave, wave]} />
      <Animated.View style={[styles.stage, stage]}>
        {children}
        <Animated.View pointerEvents="none" style={[styles.beam, beam]} />
      </Animated.View>
    </View>
  );
}

function LiveDot() {
  const styles = useStyles();
  const pulse = useLoop(1.8, 0, 'motion');
  const halo = useAnimatedStyle(() => ({ opacity: lerp(0.6, 0, pulse.value), transform: [{ scale: lerp(1, 2.6, pulse.value) }] }));
  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.dotHalo, halo]} />
      <View style={styles.dot} />
    </View>
  );
}

// A deep green card in both themes, so it stands apart from the bright carousel above it.
const useStyles = makeStyles(() => ({
  card: {
    borderRadius: radii.xl, padding: 16, gap: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(74,222,128,0.28)',
    backgroundImage: 'linear-gradient(135deg, #07170f 0%, #0c2c1b 58%, #14532d 100%)',
  },
  glow: { position: 'absolute', right: -70, top: -70, width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(34,197,94,0.14)' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  text: { flex: 1, minWidth: 0, gap: 5 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: { ...type.tiny, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: '#86efac' },
  dotWrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  dotHalo: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  title: { fontSize: 23, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5, color: '#ffffff' },
  variant: { ...type.small, fontSize: 13, color: 'rgba(255,255,255,0.68)' },
  priceBlock: { marginTop: 4 },
  upTo: { ...type.small, fontSize: 12, color: 'rgba(255,255,255,0.68)' },
  price: { fontSize: 28, lineHeight: 33, fontWeight: '900', letterSpacing: -0.8, color: '#86efac' },
  worth: { ...type.small, fontSize: 14, lineHeight: 19, color: 'rgba(255,255,255,0.78)', marginTop: 2 },
  stageWrap: { width: STAGE_WIDTH, height: STAGE_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  wave: { position: 'absolute', width: STAGE_WIDTH, height: STAGE_HEIGHT, borderRadius: 26, borderWidth: 1.5, borderColor: '#4ade80' },
  stage: {
    width: STAGE_WIDTH, height: STAGE_HEIGHT, borderRadius: 24, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', boxShadow: '0px 10px 26px rgba(0,0,0,0.35)',
  },
  beam: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 22, borderBottomWidth: 2, borderBottomColor: '#22c55e',
    backgroundImage: 'linear-gradient(180deg, rgba(34,197,94,0) 0%, rgba(34,197,94,0.3) 100%)',
  },
  logo: { width: STAGE_WIDTH - 36, height: STAGE_WIDTH - 36 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  specs: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  spec: { borderRadius: radii.pill, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 9, paddingVertical: 3 },
  specText: { ...type.small, fontSize: 11, fontWeight: '700', color: '#dcfce7' },
  button: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: radii.pill, backgroundColor: '#ffffff', paddingLeft: 16, paddingRight: 11, height: 40 },
  buttonText: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2, color: '#0f3a24' },
}));
