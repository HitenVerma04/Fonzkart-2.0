import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useVariants } from '@fonzkart/api';
import { formatInr } from '@fonzkart/core';
import { EmptyState, ErrorState, Loading, RemoteImage, colors, font, radius, spacing } from '@fonzkart/ui';
import { PAGE_PADDING } from '../../src/grid';

export default function ModelVariants() {
  const { id, name, img } = useLocalSearchParams<{ id: string; name?: string; img?: string }>();
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
        {variants.isPending ? (
          <Loading />
        ) : variants.isError ? (
          <ErrorState onRetry={() => variants.refetch()} />
        ) : variants.data.length === 0 ? (
          <EmptyState message="No variants listed for this model yet." />
        ) : (
          variants.data.map(variant => (
            <View key={variant.id} style={styles.variant}>
              <Text style={styles.variantName}>{variant.name}</Text>
              <View style={styles.price}>
                <Text style={styles.priceLabel}>Max value</Text>
                <Text style={styles.priceValue}>{formatInr(variant.basePrice)}</Text>
              </View>
            </View>
          ))
        )}

        <Text style={styles.note}>The device check and exact quote come in the next app update.</Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: PAGE_PADDING, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, gap: spacing.md },
  name: { fontSize: font.title, fontWeight: '800', color: colors.navy, textAlign: 'center' },
  section: { fontSize: font.heading, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  variant: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  variantName: { fontSize: font.body, fontWeight: '700', color: colors.text },
  price: { alignItems: 'flex-end' },
  priceLabel: { fontSize: font.tiny, color: colors.muted },
  priceValue: { fontSize: font.heading, fontWeight: '800', color: colors.green },
  note: { fontSize: font.small, color: colors.muted, textAlign: 'center', marginTop: spacing.md },
});
