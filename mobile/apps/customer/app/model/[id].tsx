import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useVariants } from '@fonzkart/api';
import { formatInr, sellCategoryOf } from '@fonzkart/core';
import { makeStyles } from '@fonzkart/ui';
import {
  Appear, EmptyState, ErrorState, ListItem, Page, ProductImage, deviceKindOf, radii, SectionHeader, SkeletonRows, type, useDesign,
} from '../../src/design';
import { startQuote } from '../../src/quoteDraft';

export default function ModelVariants() {
  const styles = useStyles();
  const d = useDesign();
  // `variant`: the variant of the phone the app runs on (from "Sell this device"), shown first and marked.
  const { id, name, img, category, variant: mine } = useLocalSearchParams<{ id: string; name?: string; img?: string; category?: string; variant?: string }>();
  const router = useRouter();
  const variants = useVariants(id);
  const title = name ?? 'Your device';

  return (
    <>
      {/* The name is the page's big title already; the header keeps just the back button. */}
      <Stack.Screen options={{ title: '' }} />
      <Page>
        <Appear>
          <View style={[styles.hero, { boxShadow: d.shadow.md }]}>
            <View style={styles.well}>
              <ProductImage uri={img} label={title} size={170} kind={deviceKindOf(category)} />
            </View>
            <Text style={styles.name}>{title}</Text>
          </View>
        </Appear>

        <Appear index={1} style={styles.block}>
          <SectionHeader title="Choose your variant" subtitle="Then answer a few questions to get your exact price." />
          {variants.isPending ? (
            <SkeletonRows count={3} image={0} trailing />
          ) : variants.isError ? (
            <ErrorState error={variants.error} onRetry={() => variants.refetch()} />
          ) : variants.data.length === 0 ? (
            <EmptyState icon="box" message="No variants listed for this model yet." />
          ) : (
            [...variants.data].sort((a, b) => Number(b.id === mine) - Number(a.id === mine)).map(variant => (
              <ListItem
                key={variant.id}
                title={variant.name}
                subtitle={variant.id === mine ? 'Your phone' : undefined}
                highlighted={variant.id === mine}
                accessibilityLabel={`${variant.name}, max value ${formatInr(variant.basePrice)}`}
                trailing={
                  <View style={styles.price}>
                    <Text style={styles.priceLabel}>Max value</Text>
                    <Text style={styles.priceValue}>{formatInr(variant.basePrice)}</Text>
                  </View>
                }
                onPress={() => {
                  startQuote({
                    modelId: id,
                    modelName: title,
                    img: img ?? '',
                    variantId: variant.id,
                    variantName: variant.name,
                    basePrice: variant.basePrice,
                    category: sellCategoryOf(category),
                  });
                  router.push('/quote/questions');
                }}
              />
            ))
          )}
        </Appear>
      </Page>
    </>
  );
}

const useStyles = makeStyles(colors => ({
  hero: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 14 },
  well: {
    alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, borderRadius: radii.lg,
    backgroundImage: `radial-gradient(circle at 50% 45%, ${colors.greenTint} 0%, ${colors.greenSoft} 55%, ${colors.surface} 100%)`,
  },
  name: { ...type.title, color: colors.navy, textAlign: 'center', paddingHorizontal: 8, paddingBottom: 6 },
  block: { gap: 10 },
  price: { alignItems: 'flex-end' },
  priceLabel: { ...type.small, fontSize: 11, color: colors.muted },
  priceValue: { ...type.heading, fontWeight: '800', color: colors.green },
}));
