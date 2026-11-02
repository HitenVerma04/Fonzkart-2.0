// "Sell this phone": the phone the app is running on, found in the catalog by its model name, with its best price.
// Android reports some models only by a code (e.g. Samsung's "SM-S911B"); then the card offers the maker's models
// instead. Hidden where the device is unknown (the web build).
import { Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Device from 'expo-device';
import { MIN_SEARCH_LENGTH, useBrands, useModelSearch, useVariants, type Model } from '@fonzkart/api';
import { formatInr, modelImage } from '@fonzkart/core';
import { makeStyles, useColors } from '@fonzkart/ui';
import { deviceKindOf, Icon, ProductImage, radii, Skeleton, Tap, type, useDesign } from '../design';

const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** The catalog model that best matches the phone's model name: an exact or "ends with" name match first. */
function bestMatch(models: Model[] | undefined, modelName: string): Model | undefined {
  if (!models?.length) return undefined;
  const want = normal(modelName);
  return models.find(m => normal(m.name) === want)
    ?? models.find(m => normal(m.name).endsWith(want))
    ?? models.find(m => normal(m.name).includes(want));
}

export function SellThisDevice() {
  const styles = useStyles();
  const colors = useColors();
  const d = useDesign();
  const router = useRouter();
  const maker = (Device.brand ?? Device.manufacturer ?? '').trim();
  const modelName = (Device.modelName ?? '').trim();
  const known = Platform.OS !== 'web' && !!maker && modelName.length >= MIN_SEARCH_LENGTH;
  const isTablet = Device.deviceType === Device.DeviceType.TABLET;

  const search = useModelSearch(known ? modelName : '');
  const match = bestMatch(search.data, modelName);
  const variants = useVariants(match?.id);
  const brands = useBrands(isTablet ? 'tablet' : 'smartphone');
  const brand = brands.data?.find(b => normal(b.name) === normal(maker) || normal(maker).startsWith(normal(b.name)));

  if (!known || (!match && !brand && !search.isPending)) return null;

  const best = variants.data?.length ? Math.max(...variants.data.map(v => v.basePrice)) : undefined;
  const category = match?.category ?? (isTablet ? 'tablet' : 'smartphone');
  const img = match ? modelImage(match.img, category) : null;
  const what = isTablet ? 'tablet' : 'phone';

  const open = () => {
    if (match) {
      router.push({ pathname: '/model/[id]', params: { id: match.id, name: match.name, img: img ?? '', category } });
    } else if (brand) {
      router.push({ pathname: '/brand/[id]', params: { id: brand.id, category, name: brand.name } });
    }
  };

  return (
    <Tap onPress={open} scaleTo={0.98} accessibilityRole="button"
      accessibilityLabel={match ? `Sell this ${what}: ${match.name}${best ? `, get up to ${formatInr(best)}` : ''}` : `Sell this ${maker} ${what}`}
      style={[styles.card, { boxShadow: d.shadow.sm }]}>
      <View style={styles.thumb}>
        {match ? <ProductImage uri={img} label={match.name} size={56} kind={deviceKindOf(category)} /> : <Icon name="auto" color={colors.green} size={30} filled />}
      </View>
      <View style={styles.text}>
        <View style={styles.kickerRow}>
          <View style={styles.liveDot} />
          <Text style={styles.kicker}>Sell this {what}</Text>
        </View>
        {search.isPending ? (
          <Skeleton width="80%" height={16} />
        ) : (
          <Text style={styles.name} numberOfLines={1}>{match?.name ?? `Your ${maker} ${what}`}</Text>
        )}
        {match ? (
          best ? <Text style={styles.price}>Get up to <Text style={styles.priceStrong}>{formatInr(best)}</Text></Text> : <Skeleton width="50%" height={13} />
        ) : (
          <Text style={styles.hint}>Pick your model to see its price</Text>
        )}
      </View>
      <View style={[styles.button, { backgroundImage: d.greenGradient }]}>
        <Text style={[styles.buttonText, { color: d.onGreen }]}>Sell now</Text>
      </View>
    </Tap>
  );
}

const useStyles = makeStyles(colors => ({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.greenBorder, padding: 12 },
  thumb: { width: 60, height: 60, borderRadius: radii.md, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 3 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  kicker: { ...type.tiny, fontSize: 10.5, textTransform: 'uppercase', color: colors.green },
  name: { ...type.label, fontSize: 15, color: colors.navy },
  price: { ...type.small, color: colors.textSoft },
  priceStrong: { fontWeight: '800', color: colors.navy },
  hint: { ...type.small, color: colors.muted },
  button: { borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 9 },
  buttonText: { ...type.small, fontWeight: '800' },
}));
