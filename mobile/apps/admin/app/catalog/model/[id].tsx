// A model's variants and their max values (base prices). Quotes use the new values at once, everywhere.
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { catalogAdminApi, useVariants, type Variant } from '@fonzkart/api';
import { formatInr } from '@fonzkart/core';
import { Button, Card, EmptyState, ErrorState, Loading, Notice, TextField, colors, font, radius, spacing } from '@fonzkart/ui';

export default function ModelVariants() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const client = useQueryClient();
  const variants = useVariants(id);
  const [editing, setEditing] = useState<Variant | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', basePrice: '' });
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (variants.isPending) return <Loading />;
  if (variants.isError) return <ErrorState onRetry={() => variants.refetch()} />;

  const open = (v: Variant | 'new') => {
    setEditing(v);
    setMessage(null);
    setForm(v === 'new' ? { name: '', basePrice: '' } : { name: v.name, basePrice: String(v.basePrice) });
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
      setMessage({ tone: 'error', text: e instanceof Error && /not found/i.test(e.message)
        ? 'This variant comes from the built-in catalog and cannot be changed here.' : e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    const input = { modelId: id, name: form.name.trim(), basePrice: Number(form.basePrice) };
    if (editing === 'new') void run(() => catalogAdminApi.addVariant(input), `${input.name} added.`);
    else if (editing) void run(() => catalogAdminApi.updateVariant(editing.id, input), `${input.name} saved.`);
  };

  return (
    <FlatList
      data={variants.data}
      keyExtractor={v => v.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={variants.isRefetching} onRefresh={() => void variants.refetch()} />}
      ListHeaderComponent={
        <View style={styles.head}>
          <Text style={styles.title}>{name ?? 'Model'}</Text>
          {message ? <Notice tone={message.tone} text={message.text} /> : null}
          {editing ? (
            <Card title={editing === 'new' ? 'New variant' : `Edit ${editing.name}`}>
              <TextField label="Variant (e.g. 8GB + 128GB)" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} />
              <TextField label="Max value (₹)" value={form.basePrice} onChangeText={v => setForm(f => ({ ...f, basePrice: v.replace(/\D/g, '') }))}
                keyboardType="number-pad" />
              <View style={styles.row}>
                <View style={styles.flex}><Button title="Cancel" variant="secondary" onPress={() => setEditing(null)} /></View>
                <View style={styles.flex}><Button title="Save" loading={busy} disabled={!form.name.trim() || !form.basePrice} onPress={save} /></View>
              </View>
            </Card>
          ) : <Button title="Add a variant" onPress={() => open('new')} />}
        </View>
      }
      ListEmptyComponent={<EmptyState message="No variants yet." />}
      renderItem={({ item }) => (
        <View style={styles.variant}>
          <View style={styles.flex}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.price}>Max value {formatInr(item.basePrice)}</Text>
          </View>
          <Button title="Edit" variant="link" onPress={() => open(item)} />
          <Button title="Delete" variant="link" onPress={() => void run(() => catalogAdminApi.deleteVariant(item.id), `${item.name} deleted.`)} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, maxWidth: 900, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.md, marginBottom: spacing.xs },
  title: { fontSize: font.title, fontWeight: '800', color: colors.navy },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  variant: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text },
  price: { fontSize: font.small, color: colors.green, fontWeight: '700' },
});
