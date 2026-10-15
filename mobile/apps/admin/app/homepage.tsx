// The website's landing page settings (admins): the banner's "highest price" figures and the cities shown on the home
// page with their order. The website reads both from the same backend, so a change here shows there at once.
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { adminApi, catalogAdminApi, contentKeys, useBannerPrices, useHomepageCities, type BannerPrice, type City } from '@fonzkart/api';
import { Button, Card, ErrorState, Loading, Notice, colors, font, radius, spacing } from '@fonzkart/ui';

export default function Homepage() {
  const prices = useBannerPrices();
  const cities = useHomepageCities();
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  if (prices.isPending || cities.isPending) return <Loading />;
  if (prices.isError || cities.isError) return <ErrorState onRetry={() => { void prices.refetch(); void cities.refetch(); }} />;

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {message ? <Notice tone={message.tone} text={message.text} /> : null}
      <Card title="Banner prices">
        <Text style={styles.muted}>The "get up to" figure shown for each category on the home page banner.</Text>
        {prices.data.map(p => <PriceRow key={p.id} price={p} onMessage={setMessage} />)}
      </Card>
      <Card title="Cities on the home page">
        <Text style={styles.muted}>Featured cities, in this order. Feature or hide cities under Cities.</Text>
        {cities.data.map(c => <CityRow key={c.id} city={c} onMessage={setMessage} />)}
      </Card>
    </ScrollView>
  );
}

function PriceRow({ price, onMessage }: { price: BannerPrice; onMessage: (m: { tone: 'success' | 'error'; text: string }) => void }) {
  const client = useQueryClient();
  const [value, setValue] = useState(price.displayPrice);
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(price.displayPrice), [price.displayPrice]);
  const save = async () => {
    setBusy(true);
    try {
      await catalogAdminApi.saveBannerPrice(price.id, value);
      onMessage({ tone: 'success', text: `${price.categoryName}: ${value.trim()}` });
      await client.invalidateQueries({ queryKey: contentKeys.bannerPrices });
    } catch (e) {
      onMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{price.categoryName}</Text>
      <TextInput value={value} onChangeText={setValue} style={styles.input} accessibilityLabel={`${price.categoryName} banner price`} />
      <View style={styles.save}><Button title="Save" loading={busy} disabled={value.trim() === price.displayPrice} onPress={() => void save()} /></View>
    </View>
  );
}

function CityRow({ city, onMessage }: { city: City; onMessage: (m: { tone: 'success' | 'error'; text: string }) => void }) {
  const client = useQueryClient();
  const [order, setOrder] = useState(String(city.displayOrder));
  const save = async () => {
    try {
      await adminApi.setCityDisplayOrder(city.id, Number(order) || 0);
      onMessage({ tone: 'success', text: `${city.name} moved.` });
      await client.invalidateQueries({ queryKey: ['staff'] });
    } catch (e) {
      onMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not save.' });
    }
  };
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{city.name}{city.isFeatured ? ' ★' : ''}</Text>
      <TextInput value={order} onChangeText={t => setOrder(t.replace(/\D/g, ''))} keyboardType="number-pad" style={styles.input}
        accessibilityLabel={`${city.name} order`} />
      <View style={styles.save}><Button title="Save" disabled={order === String(city.displayOrder)} onPress={() => void save()} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 900, width: '100%', alignSelf: 'center' },
  muted: { fontSize: font.small, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { flex: 1, fontSize: font.body, fontWeight: '600', color: colors.text },
  input: { width: 120, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 8, fontSize: font.body, color: colors.text },
  save: { width: 90 },
});
