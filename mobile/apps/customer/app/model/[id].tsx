import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useVariants } from '@fonzkart/api';
import { formatInr, sellCategoryOf } from '@fonzkart/core';
import { EmptyState, ErrorState, Loading, RemoteImage, colors, font, radius, spacing } from '@fonzkart/ui';
import { PAGE_PADDING } from '../../src/grid';
import { startQuote } from '../../src/quoteDraft';

export default function ModelVariants() {
  const { id, name, img, category } = useLocalSearchParams<{ id: string; name?: string; img?: string; category?: string }>();
  const router = useRouter();
  const variants = useVariants(id);
  const title = name ?? 'Your device';

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.hero}>
          <RemoteImage uri={img} label={title} size={180} />
          <Text style={styles.name}>{title}</Text>
        </View>

        <Text style={styles.section}>Choose your variant</Text>
        <Text style={styles.hint}>Then answer a few questions to get your exact price.</Text>
        {variants.isPending ? (
          <Loading />
        ) : variants.isError ? (
          <ErrorState onRetry={() => variants.refetch()} />
        ) : variants.data.length === 0 ? (
          <EmptyState message="No variants listed for this model yet." />
        ) : (
          variants.data.map(variant => (
            <Pressable
              key={variant.id}
              accessibilityRole="button"
              accessibilityLabel={`${variant.name}, max value ${formatInr(variant.basePrice)}`}
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
              style={({ pressed }) => [styles.variant, pressed && styles.pressed]}
            >
              <Text style={styles.variantName}>{variant.name}</Text>
              <View style={styles.price}>
                <Text style={styles.priceLabel}>Max value</Text>
                <Text style={styles.priceValue}>{formatInr(variant.basePrice)}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: PAGE_PADDING, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, gap: spacing.md },
  name: { fontSize: font.title, fontWeight: '800', color: colors.navy, textAlign: 'center' },
  section: { fontSize: font.heading, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  hint: { fontSize: font.small, color: colors.muted, marginTop: -spacing.sm },
  variant: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingLeft: spacing.lg, paddingRight: spacing.sm, paddingVertical: spacing.md },
  pressed: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  variantName: { flex: 1, fontSize: font.body, fontWeight: '700', color: colors.text },
  price: { alignItems: 'flex-end' },
  priceLabel: { fontSize: font.tiny, color: colors.muted },
  priceValue: { fontSize: font.heading, fontWeight: '800', color: colors.green },
  chevron: { fontSize: 24, color: colors.muted },
});
