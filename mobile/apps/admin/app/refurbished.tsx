// Refurbished devices: the switch that shows Buy to customers, and the listings. Add, edit (name, brand, storage, grade,
// warranty, picture, prices, stock), show or hide, delete. A listing leaves the Customer app when its stock reaches 0.
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { DEVICE_GRADES, buyAdminApi, buyKeys, useBuyAdmin, type RefurbishedDevice, type RefurbishedDeviceInput } from '@fonzkart/api';
import { formatInr } from '@fonzkart/core';
import { Button, Card, EmptyState, ErrorState, Loading, Notice, Segmented, TextField, colors, font, radius, spacing } from '@fonzkart/ui';
import { ImageField } from '../src/ImageField';

const EMPTY: RefurbishedDeviceInput = { name: '', brand: '', storage: '', grade: 'good', warrantyMonths: 6, imageUrl: null, mrp: 0, price: 0, stock: 1, isActive: true };
const digits = (text: string, max: number) => Number(text.replace(/\D/g, '').slice(0, max)) || 0;
const gradeLabel = (id: string) => DEVICE_GRADES.find(g => g.id === id)?.label ?? id;

export default function RefurbishedEditor() {
  const client = useQueryClient();
  const buy = useBuyAdmin();
  const [editing, setEditing] = useState<RefurbishedDevice | 'new' | null>(null);
  const [form, setForm] = useState<RefurbishedDeviceInput>(EMPTY);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (buy.isPending) return <Loading />;
  if (buy.isError) return <ErrorState onRetry={() => buy.refetch()} />;
  const { enabled, items } = buy.data;

  const open = (d: RefurbishedDevice | 'new') => {
    setEditing(d);
    setMessage(null);
    setDeleting(null);
    if (d === 'new') setForm(EMPTY);
    else {
      const { id: _id, ...input } = d;
      setForm(input);
    }
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
        setDeleting(null);
        await client.invalidateQueries({ queryKey: buyKeys.admin });
        await client.invalidateQueries({ queryKey: buyKeys.store });
      }
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    const input = { ...form, name: form.name.trim(), brand: form.brand.trim(), storage: form.storage.trim(), imageUrl: form.imageUrl?.trim() || null };
    if (editing === 'new') void run(() => buyAdminApi.add(input), `"${input.name}" added.`);
    else if (editing) void run(() => buyAdminApi.update(editing.id, input), `"${input.name}" saved.`);
  };
  const remove = (d: RefurbishedDevice) => {
    if (deleting !== d.id) setDeleting(d.id);
    else void run(() => buyAdminApi.remove(d.id), `"${d.name}" deleted.`);
  };

  const priceProblem = form.mrp <= 0 ? 'Enter the MRP.' : form.price <= 0 ? 'Enter the sale price.' : form.price > form.mrp ? 'The sale price cannot be more than the MRP.' : '';
  const canSave = !!form.name.trim() && !!form.brand.trim() && !!form.storage.trim() && !priceProblem;

  return (
    <FlatList
      data={items}
      keyExtractor={d => d.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={buy.isRefetching} onRefresh={() => void buy.refetch()} />}
      ListHeaderComponent={
        <View style={styles.head}>
          <Card title="Buy switch">
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={styles.label}>Show Buy to customers</Text>
                <Text style={styles.muted}>Off: the Customer app's Buy tab shows a "stock on its way" message and takes no orders.</Text>
              </View>
              <Switch value={enabled} disabled={busy} trackColor={{ true: colors.green }} accessibilityLabel="Show Buy to customers"
                onValueChange={on => void run(() => buyAdminApi.setEnabled(on), on ? 'Buy is now shown to customers.' : 'Buy is now hidden from customers.')} />
            </View>
          </Card>
          {message ? <Notice tone={message.tone} text={message.text} /> : null}
          {editing ? (
            <Card title={editing === 'new' ? 'New device' : 'Edit device'}>
              <TextField label="Name" value={form.name} maxLength={80} placeholder="e.g. iPhone 13" onChangeText={name => setForm(f => ({ ...f, name }))} />
              <View style={styles.row}>
                <View style={styles.flex}><TextField label="Brand" value={form.brand} maxLength={40} placeholder="e.g. Apple" onChangeText={brand => setForm(f => ({ ...f, brand }))} /></View>
                <View style={styles.flex}><TextField label="Storage" value={form.storage} maxLength={40} placeholder="e.g. 128 GB" onChangeText={storage => setForm(f => ({ ...f, storage }))} /></View>
              </View>
              <Text style={styles.label}>Condition</Text>
              <Segmented options={DEVICE_GRADES} value={form.grade} onChange={grade => setForm(f => ({ ...f, grade }))} />
              <ImageField label="Picture (optional)" value={form.imageUrl ?? ''} onChange={url => setForm(f => ({ ...f, imageUrl: url || null }))} />
              <View style={styles.row}>
                <View style={styles.flex}><TextField label="MRP (₹)" value={form.mrp ? String(form.mrp) : ''} keyboardType="number-pad" onChangeText={t => setForm(f => ({ ...f, mrp: digits(t, 7) }))} /></View>
                <View style={styles.flex}><TextField label="Sale price (₹)" value={form.price ? String(form.price) : ''} keyboardType="number-pad" onChangeText={t => setForm(f => ({ ...f, price: digits(t, 7) }))} /></View>
              </View>
              <View style={styles.row}>
                <View style={styles.flex}><TextField label="Stock" value={String(form.stock)} keyboardType="number-pad" onChangeText={t => setForm(f => ({ ...f, stock: digits(t, 4) }))} /></View>
                <View style={styles.flex}><TextField label="Warranty (months)" value={String(form.warrantyMonths)} keyboardType="number-pad" onChangeText={t => setForm(f => ({ ...f, warrantyMonths: digits(t, 2) }))} /></View>
              </View>
              {priceProblem && (form.mrp || form.price) ? <Notice tone="error" text={priceProblem} /> : null}
              <View style={styles.switchRow}>
                <Text style={[styles.label, styles.flex]}>Show to customers</Text>
                <Switch value={form.isActive} trackColor={{ true: colors.green }} accessibilityLabel="Show to customers" onValueChange={isActive => setForm(f => ({ ...f, isActive }))} />
              </View>
              <View style={styles.row}>
                <View style={styles.flex}><Button title="Cancel" variant="secondary" onPress={() => setEditing(null)} /></View>
                <View style={styles.flex}><Button title="Save" loading={busy} disabled={!canSave} onPress={save} /></View>
              </View>
            </Card>
          ) : <Button title="Add device" onPress={() => open('new')} />}
        </View>
      }
      ListEmptyComponent={<EmptyState message="No devices yet. Customers see an empty Buy tab until you add one." />}
      renderItem={({ item }) => (
        <View style={[styles.item, !item.isActive && styles.hidden]}>
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.muted}>{item.brand} · {item.storage} · {gradeLabel(item.grade)}</Text>
            <Text style={styles.price}>{formatInr(item.price)} <Text style={styles.muted}>MRP {formatInr(item.mrp)}</Text></Text>
            <Text style={styles.muted}>{item.stock ? `${item.stock} in stock` : 'Sold out'}{item.isActive ? '' : ' · Hidden'}</Text>
          </View>
          <View style={styles.actions}>
            <Button title="Edit" variant="link" onPress={() => open(item)} />
            <Button title={deleting === item.id ? 'Confirm' : 'Delete'} variant="link" onPress={() => remove(item)} />
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, maxWidth: 900, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.md, marginBottom: spacing.xs },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { fontSize: font.small, fontWeight: '700', color: colors.text },
  muted: { fontSize: font.small, color: colors.muted, fontWeight: '400' },
  item: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  hidden: { opacity: 0.6 },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text },
  price: { fontSize: font.body, fontWeight: '800', color: colors.green },
  actions: { alignItems: 'flex-end', justifyContent: 'center' },
});
