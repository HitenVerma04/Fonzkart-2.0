// Repair prices: the switch that shows Repair to customers, and the fixed price of each repair for each phone. Search a
// phone to edit its prices; a repair without a price is not offered for that phone.
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { REPAIR_ISSUES, repairAdminApi, repairKeys, useRepairAdmin, type RepairPrice, type RepairPriceInput } from '@fonzkart/api';
import { formatInr } from '@fonzkart/core';
import { Button, Card, EmptyState, ErrorState, Loading, Notice, Segmented, TextField, colors, font, radius, spacing } from '@fonzkart/ui';

const EMPTY: RepairPriceInput = { brand: '', model: '', issue: 'screen', price: 0, isActive: true };
const SHOWN = 60;
const issueLabel = (id: string) => REPAIR_ISSUES.find(i => i.id === id)?.label ?? id;
const toRupees = (text: string) => Number(text.replace(/\D/g, '').slice(0, 6)) || 0;

export default function RepairPriceEditor() {
  const client = useQueryClient();
  const repair = useRepairAdmin();
  const [editing, setEditing] = useState<RepairPrice | 'new' | null>(null);
  const [form, setForm] = useState<RepairPriceInput>(EMPTY);
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const items = repair.data?.items;
  const words = query.trim().toLowerCase();
  const matching = useMemo(() => (items ?? []).filter(p => !words || `${p.brand} ${p.model}`.toLowerCase().includes(words)), [items, words]);

  if (repair.isPending) return <Loading />;
  if (repair.isError) return <ErrorState onRetry={() => repair.refetch()} />;
  const { enabled } = repair.data;

  const open = (p: RepairPrice | 'new') => {
    setEditing(p);
    setMessage(null);
    setDeleting(null);
    if (p === 'new') setForm(EMPTY);
    else {
      const { id: _id, ...input } = p;
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
        await client.invalidateQueries({ queryKey: repairKeys.admin });
        await client.invalidateQueries({ queryKey: repairKeys.prices });
      }
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    const input = { ...form, brand: form.brand.trim(), model: form.model.trim() };
    if (editing === 'new') void run(() => repairAdminApi.add(input), `Price added for ${input.model}.`);
    else if (editing) void run(() => repairAdminApi.update(editing.id, input), `Price saved for ${input.model}.`);
  };
  const remove = (p: RepairPrice) => {
    if (deleting !== p.id) setDeleting(p.id);
    else void run(() => repairAdminApi.remove(p.id), 'Price deleted.');
  };
  const canSave = !!form.brand.trim() && !!form.model.trim() && form.price > 0;

  return (
    <FlatList
      data={matching.slice(0, SHOWN)}
      keyExtractor={p => p.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={repair.isRefetching} onRefresh={() => void repair.refetch()} />}
      ListHeaderComponent={
        <View style={styles.head}>
          <Card title="Repair switch">
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={styles.label}>Show Repair to customers</Text>
                <Text style={styles.muted}>Off: the Customer app's Repair tab shows a "starting soon" message and takes no bookings.</Text>
              </View>
              <Switch value={enabled} disabled={busy} trackColor={{ true: colors.green }} accessibilityLabel="Show Repair to customers"
                onValueChange={on => void run(() => repairAdminApi.setEnabled(on), on ? 'Repair is now shown to customers.' : 'Repair is now hidden from customers.')} />
            </View>
          </Card>
          {message ? <Notice tone={message.tone} text={message.text} /> : null}
          {editing ? (
            <Card title={editing === 'new' ? 'New price' : 'Edit price'}>
              <View style={styles.row}>
                <View style={styles.flex}><TextField label="Phone brand" value={form.brand} maxLength={40} placeholder="e.g. Apple" onChangeText={brand => setForm(f => ({ ...f, brand }))} /></View>
                <View style={styles.flex}><TextField label="Phone model" value={form.model} maxLength={40} placeholder="e.g. iPhone 15" onChangeText={model => setForm(f => ({ ...f, model }))} /></View>
              </View>
              <Text style={styles.label}>Repair</Text>
              <Segmented options={REPAIR_ISSUES} value={form.issue} onChange={issue => setForm(f => ({ ...f, issue }))} />
              <TextField label="Price (₹)" value={form.price ? String(form.price) : ''} keyboardType="number-pad" onChangeText={t => setForm(f => ({ ...f, price: toRupees(t) }))} />
              <View style={styles.switchRow}>
                <Text style={[styles.label, styles.flex]}>Offer this repair</Text>
                <Switch value={form.isActive} trackColor={{ true: colors.green }} accessibilityLabel="Offer this repair" onValueChange={isActive => setForm(f => ({ ...f, isActive }))} />
              </View>
              <View style={styles.row}>
                <View style={styles.flex}><Button title="Cancel" variant="secondary" onPress={() => setEditing(null)} /></View>
                <View style={styles.flex}><Button title="Save" loading={busy} disabled={!canSave} onPress={save} /></View>
              </View>
            </Card>
          ) : <Button title="Add price" onPress={() => open('new')} />}
          <TextField label="Find a phone" value={query} onChangeText={setQuery} placeholder="e.g. iPhone 15"
            hint={matching.length > SHOWN ? `Showing ${SHOWN} of ${matching.length}. Search to narrow it down.` : `${matching.length} prices`} />
        </View>
      }
      ListEmptyComponent={<EmptyState message="No prices here. Customers only see phones that have prices." />}
      renderItem={({ item }) => (
        <View style={[styles.item, !item.isActive && styles.hidden]}>
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>{item.model}</Text>
            <Text style={styles.muted}>{issueLabel(item.issue)}{item.isActive ? '' : ' · Hidden'}</Text>
            <Text style={styles.price}>{formatInr(item.price)}</Text>
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
  muted: { fontSize: font.small, color: colors.muted },
  item: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  hidden: { opacity: 0.6 },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text },
  price: { fontSize: font.body, fontWeight: '800', color: colors.green },
  actions: { alignItems: 'flex-end', justifyContent: 'center' },
});
