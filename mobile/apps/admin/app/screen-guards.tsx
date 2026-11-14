// Screen guard store: the two switches (store shown to customers, discounts on) and the guards the Customer app sells.
// Add, edit (name, type, phone it fits, picture, MRP, sale price), show or hide, delete. The Customer app reads the
// same data from the backend, so a change shows there within a minute or when the app is reopened.
import { useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  GUARD_TYPES, discountPercent, shopAdminApi, shopKeys, useShopAdmin, type ScreenGuard, type ScreenGuardInput, type ShopSettings,
} from '@fonzkart/api';
import { formatInr, imageUrl } from '@fonzkart/core';
import { Button, Card, EmptyState, ErrorState, Loading, Notice, Segmented, TextField, colors, font, radius, spacing } from '@fonzkart/ui';
import { ImageField } from '../src/ImageField';

const MAX_NAME = 80;
const MAX_PHONE = 40;
const EMPTY: ScreenGuardInput = { name: '', guardType: 'tempered', brand: '', model: '', imageUrl: null, mrp: 0, price: 0, isActive: true };
const typeLabel = (id: string) => GUARD_TYPES.find(t => t.id === id)?.label ?? id;
const toRupees = (text: string) => Number(text.replace(/\D/g, '').slice(0, 7)) || 0;
/** The sale price for a percent off the MRP, rounded down to whole rupees so the shown "% off" is never less than asked. */
const priceFor = (mrp: number, percent: number) => Math.max(1, Math.floor((mrp * (100 - Math.min(Math.max(percent, 0), 99))) / 100));
const QUICK_PERCENTS = [0, 10, 15, 20, 25, 30, 40, 50];

export default function ScreenGuardStoreEditor() {
  const client = useQueryClient();
  const shop = useShopAdmin();
  const [editing, setEditing] = useState<ScreenGuard | 'new' | null>(null);
  const [form, setForm] = useState<ScreenGuardInput>(EMPTY);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // The discount percent as typed; empty when the sale price was typed instead (then the percent is worked out).
  const [pctText, setPctText] = useState('');
  const [bulkPct, setBulkPct] = useState('');

  if (shop.isPending) return <Loading />;
  if (shop.isError) return <ErrorState onRetry={() => shop.refetch()} />;
  const { settings, items } = shop.data;

  const open = (g: ScreenGuard | 'new') => {
    setEditing(g);
    setMessage(null);
    setDeleting(null);
    setPctText('');
    setForm(g === 'new' ? EMPTY : {
      name: g.name, guardType: g.guardType, brand: g.brand, model: g.model, imageUrl: g.imageUrl, mrp: g.mrp, price: g.price, isActive: g.isActive,
      displayOrder: g.displayOrder,
    });
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
        await client.invalidateQueries({ queryKey: shopKeys.admin });
        await client.invalidateQueries({ queryKey: shopKeys.store });
      }
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = (next: ShopSettings, done: string) => void run(() => shopAdminApi.saveSettings(next), done);

  const save = () => {
    const input: ScreenGuardInput = {
      ...form, name: form.name.trim(), brand: form.brand.trim(), model: form.model.trim(),
      imageUrl: form.imageUrl?.trim() ? form.imageUrl.trim() : null,
    };
    if (editing === 'new') void run(() => shopAdminApi.add(input), `"${input.name}" added.`);
    else if (editing) void run(() => shopAdminApi.update(editing.id, input), `"${input.name}" saved.`);
  };

  const toggle = (g: ScreenGuard) => {
    const input: ScreenGuardInput = {
      name: g.name, guardType: g.guardType, brand: g.brand, model: g.model, imageUrl: g.imageUrl, mrp: g.mrp, price: g.price,
      isActive: !g.isActive, displayOrder: g.displayOrder,
    };
    void run(() => shopAdminApi.update(g.id, input), `"${g.name}" ${input.isActive ? 'shown in the store' : 'hidden'}.`);
  };

  /** One percent off every guard's own MRP; stops at the first failure and says how far it got. */
  const applyToAll = async (percent: number) => {
    setBusy(true);
    setMessage(null);
    let done = 0;
    try {
      for (const g of items) {
        const r = await shopAdminApi.update(g.id, {
          name: g.name, guardType: g.guardType, brand: g.brand, model: g.model, imageUrl: g.imageUrl, mrp: g.mrp,
          price: priceFor(g.mrp, percent), isActive: g.isActive, displayOrder: g.displayOrder,
        });
        if (r.error) throw new Error(`${g.name}: ${r.error}`);
        done++;
      }
      setMessage({ tone: 'success', text: percent ? `${percent}% off applied to all ${done} guards.` : `Discount removed: all ${done} guards sell at MRP.` });
      setBulkPct('');
    } catch (e) {
      setMessage({ tone: 'error', text: `Updated ${done} of ${items.length}. ${e instanceof Error ? e.message : 'Something went wrong.'}` });
    } finally {
      await client.invalidateQueries({ queryKey: shopKeys.admin });
      await client.invalidateQueries({ queryKey: shopKeys.store });
      setBusy(false);
    }
  };

  const remove = (g: ScreenGuard) => {
    if (deleting !== g.id) {
      setDeleting(g.id);
      return;
    }
    void run(() => shopAdminApi.remove(g.id), `"${g.name}" deleted.`);
  };

  const priceProblem = form.mrp <= 0 ? 'Enter the MRP.' : form.price <= 0 ? 'Enter the sale price.'
    : form.price > form.mrp ? 'The sale price cannot be more than the MRP.' : '';
  const canSave = !!form.name.trim() && form.name.trim().length <= MAX_NAME && !!form.brand.trim() && !!form.model.trim()
    && form.brand.trim().length <= MAX_PHONE && form.model.trim().length <= MAX_PHONE && !priceProblem;
  const off = discountPercent(form.mrp, form.price);

  return (
    <FlatList
      data={items}
      keyExtractor={g => g.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={shop.isRefetching} onRefresh={() => void shop.refetch()} />}
      ListHeaderComponent={
        <View style={styles.head}>
          <Card title="Store switches">
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={styles.label}>Show the store to customers</Text>
                <Text style={styles.muted}>Off: the Customer app shows Screen Guard as "coming soon" and takes no orders.</Text>
              </View>
              <Switch value={settings.storeEnabled} disabled={busy} trackColor={{ true: colors.green }} accessibilityLabel="Show the store to customers"
                onValueChange={storeEnabled => saveSettings({ ...settings, storeEnabled }, storeEnabled ? 'The store is now shown to customers.' : 'The store is now hidden.')} />
            </View>
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={styles.label}>Show discounts</Text>
                <Text style={styles.muted}>
                  On: customers pay the sale price and see the MRP struck through with a "% off" badge. Off: every guard sells at its MRP.
                </Text>
              </View>
              <Switch value={settings.discountsEnabled} disabled={busy} trackColor={{ true: colors.green }} accessibilityLabel="Show discounts"
                onValueChange={discountsEnabled => saveSettings({ ...settings, discountsEnabled }, discountsEnabled ? 'Discounts are on.' : 'Discounts are off: guards sell at MRP.')} />
            </View>
          </Card>
          {items.length ? (
            <Card title="Discount on every guard">
              <Text style={styles.muted}>Sets each guard's sale price to this percent off its own MRP. You can still change single guards afterwards.</Text>
              <View style={styles.quick}>
                {QUICK_PERCENTS.map(p => (
                  <Pressable key={p} onPress={() => setBulkPct(String(p))} style={[styles.quickChip, bulkPct === String(p) && styles.quickChipOn]}
                    accessibilityRole="button" accessibilityLabel={p ? `${p}% off every guard` : 'No discount on any guard'}>
                    <Text style={[styles.quickText, bulkPct === String(p) && styles.quickTextOn]}>{p ? `${p}%` : 'None'}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <TextField label="Discount (%)" value={bulkPct} keyboardType="number-pad" placeholder="e.g. 20"
                    onChangeText={t => setBulkPct(t.replace(/\D/g, '').slice(-2))} />
                </View>
                <View style={[styles.flex, styles.bottom]}>
                  <Button title={bulkPct === '' ? 'Apply to all' : `Apply ${bulkPct}% to all ${items.length}`} loading={busy} disabled={bulkPct === '' || busy}
                    onPress={() => void applyToAll(Number(bulkPct))} />
                </View>
              </View>
            </Card>
          ) : null}
          {message ? <Notice tone={message.tone} text={message.text} /> : null}
          {editing ? (
            <Card title={editing === 'new' ? 'New guard' : 'Edit guard'}>
              <TextField label="Name" value={form.name} maxLength={MAX_NAME} hint={`${form.name.length}/${MAX_NAME}`}
                placeholder="e.g. FonzCare Tempered Glass for iPhone 15" onChangeText={name => setForm(f => ({ ...f, name }))} />
              <Text style={styles.label}>Type</Text>
              <Segmented options={GUARD_TYPES} value={form.guardType} onChange={guardType => setForm(f => ({ ...f, guardType }))} />
              <View style={styles.row}>
                <View style={styles.flex}>
                  <TextField label="Phone brand" value={form.brand} maxLength={MAX_PHONE} placeholder="e.g. Apple"
                    onChangeText={brand => setForm(f => ({ ...f, brand }))} />
                </View>
                <View style={styles.flex}>
                  <TextField label="Phone model" value={form.model} maxLength={MAX_PHONE} placeholder="e.g. iPhone 15"
                    onChangeText={model => setForm(f => ({ ...f, model }))} />
                </View>
              </View>
              <ImageField label="Picture (optional)" value={form.imageUrl ?? ''} onChange={url => setForm(f => ({ ...f, imageUrl: url || null }))} />
              <View style={styles.row}>
                <View style={styles.flex}>
                  <TextField label="MRP (₹)" value={form.mrp ? String(form.mrp) : ''} keyboardType="number-pad" placeholder="949"
                    onChangeText={t => {
                      const mrp = toRupees(t);
                      // A discount typed as a percent keeps that percent when the MRP changes.
                      setForm(f => ({ ...f, mrp, price: pctText !== '' ? priceFor(mrp, Number(pctText)) : f.price }));
                    }} />
                </View>
                <View style={styles.flex}>
                  <TextField label="Discount (%)" value={pctText !== '' ? pctText : off ? String(off) : ''} keyboardType="number-pad" placeholder="0"
                    hint="Sets the sale price"
                    onChangeText={t => {
                      const digits = t.replace(/\D/g, '').slice(-2);
                      setPctText(digits);
                      setForm(f => ({ ...f, price: digits === '' ? f.mrp : priceFor(f.mrp, Number(digits)) }));
                    }} />
                </View>
              </View>
              <TextField label="Sale price (₹)" value={form.price ? String(form.price) : ''} keyboardType="number-pad" placeholder="749"
                hint={form.mrp && form.price && form.price <= form.mrp ? `${formatInr(form.mrp - form.price)} off the MRP` : 'What the customer pays'}
                onChangeText={t => {
                  setPctText('');
                  setForm(f => ({ ...f, price: toRupees(t) }));
                }} />
              {form.mrp > 0 ? (
                <View style={styles.quick}>
                  <Text style={styles.muted}>Quick discount:</Text>
                  {QUICK_PERCENTS.map(p => (
                    <Pressable key={p} onPress={() => { setPctText(p ? String(p) : ''); setForm(f => ({ ...f, price: priceFor(f.mrp, p) })); }}
                      style={[styles.quickChip, off === p && styles.quickChipOn]} accessibilityRole="button" accessibilityLabel={p ? `${p}% off` : 'No discount'}>
                      <Text style={[styles.quickText, off === p && styles.quickTextOn]}>{p ? `${p}%` : 'None'}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {priceProblem && (form.mrp || form.price) ? <Notice tone="error" text={priceProblem} /> : null}
              {!priceProblem ? (
                <View style={styles.previewPrice}>
                  <Text style={styles.price}>{formatInr(form.price)}</Text>
                  {off ? <Text style={styles.mrp}>{formatInr(form.mrp)}</Text> : null}
                  {off ? <Text style={styles.off}>{off}% off</Text> : <Text style={styles.muted}>No discount</Text>}
                </View>
              ) : null}
              <View style={styles.switchRow}>
                <Text style={[styles.label, styles.flex]}>Show in the store</Text>
                <Switch value={form.isActive} trackColor={{ true: colors.green }} onValueChange={isActive => setForm(f => ({ ...f, isActive }))}
                  accessibilityLabel="Show in the store" />
              </View>
              <View style={styles.row}>
                <View style={styles.flex}><Button title="Cancel" variant="secondary" onPress={() => setEditing(null)} /></View>
                <View style={styles.flex}><Button title="Save" loading={busy} disabled={!canSave} onPress={save} /></View>
              </View>
            </Card>
          ) : <Button title="Add guard" onPress={() => open('new')} />}
        </View>
      }
      ListEmptyComponent={<EmptyState message="No guards yet. Customers see an empty store until you add one." />}
      renderItem={({ item }) => {
        const pct = discountPercent(item.mrp, item.price);
        return (
          <View style={[styles.guard, !item.isActive && styles.hidden]}>
            <Thumb uri={item.imageUrl} />
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.muted}>{typeLabel(item.guardType)} · {item.brand} · {item.model}</Text>
              <View style={styles.previewPrice}>
                <Text style={styles.price}>{formatInr(item.price)}</Text>
                {pct ? <Text style={styles.mrp}>{formatInr(item.mrp)}</Text> : null}
                {pct ? <Text style={styles.off}>{pct}% off</Text> : null}
              </View>
              <Text style={[styles.badge, item.isActive ? styles.badgeOn : styles.badgeOff]}>{item.isActive ? 'Active' : 'Hidden'}</Text>
            </View>
            <View style={styles.actions}>
              <Button title="Edit" variant="link" onPress={() => open(item)} />
              <Button title={item.isActive ? 'Hide' : 'Show'} variant="link" disabled={busy} onPress={() => toggle(item)} />
              <Button title={deleting === item.id ? 'Tap again to delete' : 'Delete'} variant="link" disabled={busy} onPress={() => remove(item)} />
            </View>
          </View>
        );
      }}
    />
  );
}

function Thumb({ uri }: { uri: string | null }) {
  const url = imageUrl(uri);
  return url ? <Image source={{ uri: url }} style={styles.thumb} resizeMode="contain" /> : <View style={styles.thumb} />;
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, maxWidth: 900, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.md, marginBottom: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  label: { fontSize: font.body, fontWeight: '600', color: colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  guard: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  hidden: { opacity: 0.6 },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.placeholder },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text },
  muted: { fontSize: font.small, color: colors.muted },
  previewPrice: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
  price: { fontSize: font.heading, fontWeight: '800', color: colors.text },
  mrp: { fontSize: font.small, color: colors.muted, textDecorationLine: 'line-through' },
  off: { fontSize: font.small, fontWeight: '800', color: colors.green },
  badge: { alignSelf: 'flex-start', marginTop: 4, fontSize: font.tiny, fontWeight: '800', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  badgeOn: { backgroundColor: colors.greenTint, color: colors.greenDark },
  badgeOff: { backgroundColor: colors.placeholder, color: colors.muted },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  bottom: { justifyContent: 'flex-end' },
  quick: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  quickChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  quickChipOn: { backgroundColor: colors.green, borderColor: colors.green },
  quickText: { fontSize: font.small, fontWeight: '700', color: colors.text },
  quickTextOn: { color: colors.white },
});
