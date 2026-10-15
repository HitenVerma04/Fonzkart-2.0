// Catalog (admins; the website's Inventory pages): the brands of each category. Changes show at once on the website
// and in the Customer app, which read the catalog from the same backend.
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { catalogAdminApi, useBrands, type Brand } from '@fonzkart/api';
import { Button, Card, EmptyState, ErrorState, Loading, Notice, RemoteImage, Segmented, TextField, colors, font, radius, spacing } from '@fonzkart/ui';
import { ImageField } from '../../src/ImageField';
import { CATALOG_CATEGORIES } from '../../src/catalogCategories';

export default function Catalog() {
  const router = useRouter();
  const client = useQueryClient();
  const [category, setCategory] = useState<string>('smartphone');
  const brands = useBrands(category);
  const [editing, setEditing] = useState<Brand | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', logo: '', priority: '100' });
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const open = (b: Brand | 'new') => {
    setEditing(b);
    setMessage(null);
    setForm(b === 'new' ? { name: '', logo: '', priority: '100' } : { name: b.name, logo: b.logo ?? '', priority: String(b.priority ?? 100) });
  };
  const run = async (task: () => Promise<{ error?: string }>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await task();
      if (r.error) setMessage({ tone: 'error', text: r.error });
      else {
        setMessage({ tone: 'success', text: done });
        setEditing(null);
        await client.invalidateQueries({ queryKey: ['catalog'] });
      }
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const priority = Number(form.priority) || 100;
    if (editing === 'new') {
      void run(() => catalogAdminApi.addBrand({ name: form.name.trim(), logo: form.logo.trim(), category, priority }), `${form.name.trim()} added.`);
    } else if (editing) {
      void run(() => catalogAdminApi.updateBrand(editing.id, { name: form.name.trim(), logo: form.logo.trim(), priority }), `${form.name.trim()} saved.`);
    }
  };

  return (
    <FlatList
      data={brands.data ?? []}
      keyExtractor={b => b.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={brands.isRefetching} onRefresh={() => void brands.refetch()} />}
      ListHeaderComponent={
        <View style={styles.head}>
          <Segmented value={category} onChange={c => { setCategory(c); setEditing(null); }} options={CATALOG_CATEGORIES.map(c => ({ id: c.id, label: c.label }))} />
          {message ? <Notice tone={message.tone} text={message.text} /> : null}
          {editing ? (
            <Card title={editing === 'new' ? 'New brand' : `Edit ${editing.name}`}>
              <TextField label="Name" value={form.name} onChangeText={name => setForm(f => ({ ...f, name }))} />
              <ImageField label="Logo" value={form.logo} onChange={logo => setForm(f => ({ ...f, logo }))} />
              <TextField label="Order (lower first)" value={form.priority} onChangeText={priority => setForm(f => ({ ...f, priority: priority.replace(/\D/g, '') }))}
                keyboardType="number-pad" />
              <View style={styles.row}>
                <View style={styles.flex}><Button title="Cancel" variant="secondary" onPress={() => setEditing(null)} /></View>
                <View style={styles.flex}><Button title="Save" loading={busy} disabled={!form.name.trim()} onPress={save} /></View>
              </View>
              {editing !== 'new' ? (
                <Button title={`Remove from ${CATALOG_CATEGORIES.find(c => c.id === category)?.label}`} variant="link"
                  onPress={() => void run(() => catalogAdminApi.deleteBrand(editing.id, category), `${editing.name} removed from this category.`)} />
              ) : null}
            </Card>
          ) : <Button title="Add a brand" onPress={() => open('new')} />}
          {brands.isPending ? <Loading /> : brands.isError ? <ErrorState onRetry={() => brands.refetch()} /> : null}
        </View>
      }
      ListEmptyComponent={brands.isPending ? null : <EmptyState message="No brands in this category yet." />}
      renderItem={({ item }) => (
        <View style={styles.brand}>
          <RemoteImage uri={item.logo} label={item.name} size={44} />
          <View style={styles.flex}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.muted}>Order {item.priority ?? 100} · {item.categories.join(', ') || 'no category'}</Text>
          </View>
          <Button title="Edit" variant="link" onPress={() => open(item)} />
          <Button title="Models" variant="link"
            onPress={() => router.push({ pathname: '/catalog/brand/[id]', params: { id: item.id, category, name: item.name } })} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, maxWidth: 900, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.md, marginBottom: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text },
  muted: { fontSize: font.small, color: colors.muted },
});
