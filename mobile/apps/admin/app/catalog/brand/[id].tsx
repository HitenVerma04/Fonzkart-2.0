// A brand's models in one category: add, edit (name, picture, order), move up/down, delete (with its variants).
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { catalogAdminApi, useModels, type Model } from '@fonzkart/api';
import { Button, Card, EmptyState, ErrorState, Loading, Notice, RemoteImage, TextField, colors, font, radius, spacing } from '@fonzkart/ui';
import { ImageField } from '../../../src/ImageField';

export default function BrandModels() {
  const { id, category, name } = useLocalSearchParams<{ id: string; category: string; name?: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const models = useModels(id, category);
  const [editing, setEditing] = useState<Model | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', img: '', priority: '100' });
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (models.isPending) return <Loading />;
  if (models.isError) return <ErrorState onRetry={() => models.refetch()} />;
  const list = models.data;

  const open = (m: Model | 'new') => {
    setEditing(m);
    setMessage(null);
    setForm(m === 'new' ? { name: '', img: '', priority: '100' } : { name: m.name, img: m.img ?? '', priority: String(m.priority ?? 100) });
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
      // Built-in 2026 catalog models are not stored rows; the server cannot edit them.
      setMessage({ tone: 'error', text: e instanceof Error && /not found/i.test(e.message)
        ? 'This model comes from the built-in catalog and cannot be changed here.' : e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const input = { brandId: id, name: form.name.trim(), img: form.img.trim(), category, priority: Number(form.priority) || 100 };
    if (editing === 'new') void run(() => catalogAdminApi.addModel(input), `${input.name} added.`);
    else if (editing) void run(() => catalogAdminApi.updateModel(editing.id, input), `${input.name} saved.`);
  };

  // Move a model one place: the two swap their order numbers (reorderModels).
  const move = (index: number, by: -1 | 1) => {
    const a = list[index];
    const b = list[index + by];
    if (!a || !b) return;
    const pa = a.priority ?? 100;
    const pb = b.priority ?? 100;
    const items = pa === pb
      ? [{ id: a.id, priority: pb + by }, { id: b.id, priority: pa }]
      : [{ id: a.id, priority: pb }, { id: b.id, priority: pa }];
    void run(() => catalogAdminApi.reorderModels(items), `${a.name} moved.`);
  };

  const remove = (m: Model) => void run(() => catalogAdminApi.deleteModel(m.id), `${m.name} deleted.`);

  return (
    <FlatList
      data={list}
      keyExtractor={m => m.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={models.isRefetching} onRefresh={() => void models.refetch()} />}
      ListHeaderComponent={
        <View style={styles.head}>
          <Text style={styles.title}>{name ?? id} · {category}</Text>
          {message ? <Notice tone={message.tone} text={message.text} /> : null}
          {editing ? (
            <Card title={editing === 'new' ? 'New model' : `Edit ${editing.name}`}>
              <TextField label="Name" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} />
              <ImageField label="Picture" value={form.img} onChange={img => setForm(f => ({ ...f, img }))} />
              <TextField label="Order (lower first)" value={form.priority} onChangeText={v => setForm(f => ({ ...f, priority: v.replace(/\D/g, '') }))}
                keyboardType="number-pad" />
              <View style={styles.row}>
                <View style={styles.flex}><Button title="Cancel" variant="secondary" onPress={() => setEditing(null)} /></View>
                <View style={styles.flex}><Button title="Save" loading={busy} disabled={!form.name.trim()} onPress={save} /></View>
              </View>
            </Card>
          ) : <Button title="Add a model" onPress={() => open('new')} />}
        </View>
      }
      ListEmptyComponent={<EmptyState message="No models yet." />}
      renderItem={({ item, index }) => (
        <View style={styles.model}>
          <RemoteImage uri={item.img} label={item.name} size={48} />
          <View style={styles.flex}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.muted}>Order {item.priority ?? 100}</Text>
          </View>
          <View style={styles.actions}>
            <Button title="↑" variant="link" disabled={index === 0} onPress={() => move(index, -1)} />
            <Button title="↓" variant="link" disabled={index === list.length - 1} onPress={() => move(index, 1)} />
            <Button title="Edit" variant="link" onPress={() => open(item)} />
            <Button title="Prices" variant="link" onPress={() => router.push({ pathname: '/catalog/model/[id]', params: { id: item.id, name: item.name } })} />
            <Button title="Delete" variant="link" onPress={() => remove(item)} />
          </View>
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
  model: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text },
  muted: { fontSize: font.small, color: colors.muted },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
});
