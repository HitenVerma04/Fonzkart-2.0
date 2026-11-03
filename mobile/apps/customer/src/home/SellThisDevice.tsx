// "Sell this device" (as in Cashify): the phone the app runs on, recognised from what the system reports (maker,
// model, marketing name, RAM, storage, Android version), found in the catalog with the variant of the same storage,
// and its price. "Sell now" opens that model with this phone's variant picked out. Hidden where the device is
// unknown (the web build) or not in the catalog.
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useModelSearch, useVariants } from '@fonzkart/api';
import { formatInr, modelImage } from '@fonzkart/core';
import { makeStyles, useColors } from '@fonzkart/ui';
import { deviceKindOf, Icon, ProductImage, radii, Skeleton, Tap, type, useDesign } from '../design';
import { matchModel, matchVariant, readDeviceSpecs, searchNames } from './thisDevice';

export function SellThisDevice() {
  const styles = useStyles();
  const colors = useColors();
  const d = useDesign();
  const router = useRouter();
  const specs = useMemo(readDeviceSpecs, []);
  const names = specs ? searchNames(specs) : [];

  // Up to three names to look the phone up by (a fixed number of searches, as hooks must be).
  const first = useModelSearch(names[0] ?? '');
  const second = useModelSearch(names[1] ?? '');
  const third = useModelSearch(names[2] ?? '');
  const searches = [first, second, third];
  const match = names.map((n, i) => matchModel(searches[i]!.data, n)).find(Boolean);
  const searching = names.some((_, i) => searches[i]!.isPending);
  const variants = useVariants(match?.id);
  const variant = specs ? matchVariant(variants.data, specs) : undefined;

  if (!specs || (!match && !searching)) return null;

  const category = match?.category ?? (specs.isTablet ? 'tablet' : 'smartphone');
  const img = match ? modelImage(match.img, category) : null;
  const best = variant?.basePrice ?? (variants.data?.length ? Math.max(...variants.data.map(v => v.basePrice)) : undefined);
  const specLine = [
    specs.ramGb ? `${specs.ramGb} GB RAM` : null,
    specs.storageGb ? (specs.storageGb >= 1024 ? `${specs.storageGb / 1024} TB` : `${specs.storageGb} GB`) : null,
    specs.osVersion ? `${specs.osName} ${specs.osVersion}` : null,
  ].filter(Boolean) as string[];

  const open = () => {
    if (!match) return;
    router.push({
      pathname: '/model/[id]',
      params: { id: match.id, name: match.name, img: img ?? '', category, ...(variant ? { variant: variant.id } : {}) },
    });
  };

  return (
    <Tap onPress={open} disabled={!match} scaleTo={0.98} accessibilityRole="button"
      accessibilityLabel={match ? `Sell this device: ${match.name}, ${specLine.join(', ')}${best ? `, get up to ${formatInr(best)}` : ''}` : 'Finding this device'}
      style={[styles.card, { boxShadow: d.shadow.sm }]}>
      <View style={styles.top}>
        <View style={styles.thumb}>
          {match ? <ProductImage uri={img} label={match.name} size={60} kind={deviceKindOf(category)} /> : <Icon name="auto" color={colors.green} size={30} filled />}
        </View>
        <View style={styles.text}>
          <View style={styles.kickerRow}>
            <View style={styles.liveDot} />
            <Text style={styles.kicker}>Sell this device</Text>
          </View>
          {match ? <Text style={styles.name} numberOfLines={1}>{match.name}</Text> : <Skeleton width="75%" height={16} />}
          {variant ? <Text style={styles.variant} numberOfLines={1}>{variant.name}</Text> : null}
          {best ? (
            <Text style={styles.price}>Get up to <Text style={styles.priceStrong}>{formatInr(best)}</Text></Text>
          ) : match ? <Skeleton width="45%" height={13} /> : null}
        </View>
        <View style={[styles.button, { backgroundImage: d.greenGradient }]}>
          <Text style={[styles.buttonText, { color: d.onGreen }]}>Sell now</Text>
        </View>
      </View>
      {specLine.length ? (
        <View style={styles.specs}>
          {specLine.map(s => (
            <View key={s} style={styles.spec}>
              <Text style={styles.specText}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Tap>
  );
}

const useStyles = makeStyles(colors => ({
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.greenBorder, padding: 12, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: radii.md, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  kicker: { ...type.tiny, fontSize: 10.5, textTransform: 'uppercase', color: colors.green },
  name: { ...type.label, fontSize: 15, color: colors.navy },
  variant: { ...type.small, fontSize: 12, color: colors.muted },
  price: { ...type.small, color: colors.textSoft },
  priceStrong: { fontWeight: '800', color: colors.navy },
  button: { borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 9 },
  buttonText: { ...type.small, fontWeight: '800' },
  specs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  spec: { borderRadius: radii.pill, backgroundColor: colors.greenSoft, borderWidth: 1, borderColor: colors.greenBorder, paddingHorizontal: 10, paddingVertical: 3 },
  specText: { ...type.small, fontSize: 11.5, fontWeight: '700', color: colors.greenDark },
}));
