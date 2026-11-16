// Pricing engine (admins only): what keeps prices right without editing them one by one. The overview says how much
// of the catalog prices itself and what the engine has learnt; suggestions are one tap to apply or dismiss (small,
// well-evidenced ones the engine applies itself when "auto apply" is on); resales are the data it learns most from;
// repair costs from official price lists make repair deductions exact for a model.
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  engineKeys, pricingEngineApi, useDeviceSales, useEngineOverview, useEngineSuggestions, useRepairCosts,
  type RecordSaleInput, type Suggestion,
} from '@fonzkart/api';
import { PART_LABELS } from '@fonzkart/core';
import { Button, Card, EmptyState, ErrorState, InfoRow, Loading, Notice, Segmented, colors, font, radius, spacing } from '@fonzkart/ui';

type Tab = 'overview' | 'suggestions' | 'resales' | 'repairs';
type Message = { tone: 'success' | 'error'; text: string };

const inr = (n: number | null | undefined) => (typeof n === 'number' ? `₹${Math.round(n).toLocaleString('en-IN')}` : '—');
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');
const GRADES = ['superb', 'good', 'fair', 'parts'] as const;
const SOURCES = ['official', 'admin'] as const;
const CATEGORIES = ['smartphone', 'tablet', 'watch', 'laptop', 'smarttv', 'camera', 'desktop'] as const;

export default function PricingEngine() {
  const [tab, setTab] = useState<Tab>('overview');
  const overview = useEngineOverview();
  const open = overview.data ? Object.values(overview.data.openSuggestions).reduce((a, b) => a + b, 0) : undefined;
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={overview.isRefetching} onRefresh={() => void overview.refetch()} />}>
      <Segmented<Tab> value={tab} onChange={setTab} options={[
        { id: 'overview', label: 'Overview' },
        { id: 'suggestions', label: 'Suggestions', count: open },
        { id: 'resales', label: 'Resales' },
        { id: 'repairs', label: 'Repairs' },
      ]} />
      {tab === 'overview' ? <Overview /> : tab === 'suggestions' ? <Suggestions /> : tab === 'resales' ? <Resales /> : <RepairCosts />}
    </ScrollView>
  );
}

// ------------------------------------------------------------------------------------------------ overview

function Overview() {
  const client = useQueryClient();
  const overview = useEngineOverview();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [margin, setMargin] = useState<string | null>(null);
  const [logistics, setLogistics] = useState<string | null>(null);
  if (overview.isPending) return <Loading />;
  if (overview.isError) return <ErrorState onRetry={() => void overview.refetch()} />;
  const o = overview.data;
  const pctOf = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '—');

  const run = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await pricingEngineApi.run();
      setMessage({ tone: 'success', text: `Done: ${r.recommendations} open suggestions, ${r.autoApplied} applied automatically, ${r.resolved} resolved.` });
      await client.invalidateQueries({ queryKey: engineKeys.all });
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };
  const save = async (body: Parameters<typeof pricingEngineApi.saveSettings>[0]) => {
    setMessage(null);
    try {
      await pricingEngineApi.saveSettings(body);
      setMessage({ tone: 'success', text: 'Saved. Quotes use it at once.' });
      await client.invalidateQueries({ queryKey: engineKeys.overview });
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e) });
    }
  };

  return (
    <View style={styles.stack}>
      <Card title="How prices are kept">
        <InfoRow label="Variants priced" value={`${o.catalog.priced} of ${o.catalog.variants}`} />
        <InfoRow label="Kept current automatically" value={`${o.catalog.auto} (${pctOf(o.catalog.auto, o.catalog.variants)})`} />
        <InfoRow label="Models with a launch price" value={`${o.catalog.modelsWithLaunchReference} of ${o.catalog.models}`} />
        <Text style={styles.muted}>
          A variant with a launch price is revalued every month from its age and what resales show. Your own price edits
          are never overwritten. Add launch prices to automate more.
        </Text>
      </Card>

      <Card title="What the engine has learnt">
        <InfoRow label="Resales recorded" value={`${o.learning.sales} (${o.learning.salesLast90Days} in 90 days)`} />
        <InfoRow label="Resale margin, 90 days" value={o.learning.marginLast90Days === null ? '—' : `${o.learning.marginLast90Days}%`} />
        <InfoRow label="Pickup checks, 90 days" value={String(o.learning.checks.checkedLast90Days ?? 0)} />
        <InfoRow label="Prices changed at pickup" value={o.learning.checks.priceChanged === undefined ? '—'
          : `${o.learning.checks.priceChanged}${o.learning.checks.averageChangePercent != null ? ` (avg ${o.learning.checks.averageChangePercent}%)` : ''}`} />
        <InfoRow label="Quotes, 30 days" value={Object.entries(o.learning.quotesLast30Days).map(([k, v]) => `${v} ${k}`).join(', ') || '0'} />
        <InfoRow label="Repair prices on file" value={Object.entries(o.repairCostSources).map(([k, v]) => `${v} ${k.replace('_', ' ')}`).join(', ')} />
        <InfoRow label="Last run" value={o.learning.lastRun ? new Date(o.learning.lastRun).toLocaleString('en-IN') : 'Not yet'} />
        <Button title="Run now" variant="secondary" onPress={run} loading={busy} />
        <Text style={styles.muted}>It also runs every night at 3:30.</Text>
      </Card>

      <Card title="Settings">
        <View style={styles.inline}>
          <Text style={styles.label}>Apply small, well-evidenced changes automatically</Text>
          <Switch value={o.settings.autoApply} onValueChange={v => void save({ autoApply: v })}
            trackColor={{ true: colors.green, false: colors.track }} />
        </View>
        <Text style={styles.muted}>At most 5% at a time, only with strong evidence; everything else waits for you here.</Text>
        <NumberField label="Target margin on resale (%)" value={margin ?? String(o.settings.targetMarginPercent)} onChange={setMargin}
          onSave={() => margin !== null && void save({ targetMarginPercent: Number(margin) })} />
        <NumberField label="Cost per pickup (₹)" value={logistics ?? String(o.settings.logisticsCost)} onChange={setLogistics}
          onSave={() => logistics !== null && void save({ logisticsCost: Number(logistics) })} />
        <InfoRow label="Lowest offer" value={`${o.settings.minOfferPercent}% of the max value (set on Pricing rules)`} />
      </Card>
      {message ? <Notice tone={message.tone} text={message.text} /> : null}
      <Text style={styles.footnote}>Engine {o.engineVersion}</Text>
    </View>
  );
}

// ------------------------------------------------------------------------------------------------ suggestions

function Suggestions() {
  const client = useQueryClient();
  const [status, setStatus] = useState<'open' | 'applied' | 'dismissed'>('open');
  const list = useEngineSuggestions(status);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const decide = async (s: Suggestion, action: 'apply' | 'dismiss') => {
    setBusy(s.id + action);
    setMessage(null);
    try {
      const r = await pricingEngineApi.decide(s.id, action);
      setMessage({ tone: 'success', text: action === 'apply' ? `Applied${r.variantsChanged ? `: ${r.variantsChanged} max values changed` : ''}.` : 'Dismissed for 30 days.' });
      await client.invalidateQueries({ queryKey: engineKeys.all });
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e) });
    } finally {
      setBusy(null);
    }
  };
  const value = (s: Suggestion, v: number | null) =>
    v === null ? '—' : s.kind === 'max_value' ? `×${v.toFixed(3)}` : s.kind === 'margin_alert' ? `${Math.round(v * 100)}%` : inr(v);

  return (
    <View style={styles.stack}>
      <Segmented value={status} onChange={setStatus} options={[
        { id: 'open', label: 'Open' }, { id: 'applied', label: 'Applied' }, { id: 'dismissed', label: 'Dismissed' },
      ]} />
      {message ? <Notice tone={message.tone} text={message.text} /> : null}
      {list.isPending ? <Loading /> : list.isError ? <ErrorState onRetry={() => void list.refetch()} />
        : !list.data.length ? <EmptyState message={status === 'open' ? 'Nothing to look at. Prices check out.' : 'None yet.'} />
        : list.data.map(s => (
          <Card key={s.id} title={s.title}>
            {s.detail ? <Text style={styles.body}>{s.detail}</Text> : null}
            <View style={styles.inline}>
              <Text style={styles.muted}>
                {s.kind === 'max_value' ? 'Max values' : s.kind === 'data_quality' ? 'Catalog check' : 'Margin'}
                {s.confidence != null ? ` · ${Math.round(s.confidence * 100)}% sure` : ''}
                {s.autoApplied ? ' · applied automatically' : ''}
              </Text>
              {s.suggestedValue !== null || s.currentValue !== null ? (
                <Text style={styles.change}>{value(s, s.currentValue)} → {value(s, s.suggestedValue)}</Text>
              ) : null}
            </View>
            {s.status === 'open' ? (
              <View style={styles.actions}>
                {s.suggestedValue !== null && s.kind !== 'margin_alert' ? (
                  <View style={styles.action}>
                    <Button title="Apply" onPress={() => void decide(s, 'apply')} loading={busy === s.id + 'apply'} disabled={!!busy} />
                  </View>
                ) : null}
                <View style={styles.action}>
                  <Button title="Dismiss" variant="secondary" onPress={() => void decide(s, 'dismiss')} loading={busy === s.id + 'dismiss'} disabled={!!busy} />
                </View>
              </View>
            ) : (
              <Text style={styles.muted}>{s.status} {s.decidedBy ? `by ${s.decidedBy}` : ''} {s.decidedAt ? new Date(s.decidedAt).toLocaleDateString('en-IN') : ''}</Text>
            )}
          </Card>
        ))}
    </View>
  );
}

// ------------------------------------------------------------------------------------------------ resales

function Resales() {
  const client = useQueryClient();
  const sales = useDeviceSales();
  const [orderNumber, setOrderNumber] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [grade, setGrade] = useState<(typeof GRADES)[number]>('good');
  const [repairs, setRepairs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const record = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const input: RecordSaleInput = {
        orderNumber: Number(orderNumber), salePrice: Number(salePrice), grade,
        repairs: Object.entries(repairs).filter(([, c]) => Number(c) > 0).map(([part, cost]) => ({ part, cost: Number(cost) })),
      };
      const r = await pricingEngineApi.recordSale(input);
      setMessage({ tone: 'success', text: `Recorded. Profit ${inr(r.profit)}${r.marginPercent !== null ? ` (${r.marginPercent}%)` : ''}.` });
      setOrderNumber('');
      setSalePrice('');
      setRepairs({});
      await client.invalidateQueries({ queryKey: engineKeys.all });
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.stack}>
      <Card title="Record a resale">
        <Text style={styles.muted}>What a bought device sold for and what its repairs cost: the engine learns its prices from these.</Text>
        <NumberField label="Order number" value={orderNumber} onChange={setOrderNumber} />
        <NumberField label="Sold for (₹)" value={salePrice} onChange={setSalePrice} />
        <Text style={styles.label}>Grade sold as</Text>
        <Chips options={GRADES.map(g => ({ id: g, label: g }))} value={grade} onChange={setGrade} />
        <Text style={styles.label}>Repairs done (₹)</Text>
        {Object.entries(PART_LABELS).map(([part, label]) => (
          <View key={part} style={styles.inline}>
            <Text style={styles.partLabel}>{label}</Text>
            <TextInput style={styles.smallInput} value={repairs[part] ?? ''} keyboardType="number-pad" placeholder="0"
              placeholderTextColor={colors.muted}
              onChangeText={t => setRepairs(prev => ({ ...prev, [part]: t.replace(/\D/g, '') }))} />
          </View>
        ))}
        <Button title="Record resale" onPress={record} loading={busy} disabled={!orderNumber || !salePrice} />
        {message ? <Notice tone={message.tone} text={message.text} /> : null}
      </Card>
      <Card title="Recent resales">
        {sales.isPending ? <Loading /> : sales.isError ? <ErrorState onRetry={() => void sales.refetch()} />
          : !sales.data.length ? <Text style={styles.muted}>None recorded yet.</Text>
          : sales.data.slice(0, 30).map(s => (
            <InfoRow key={s.id} label={`${s.device} · ${s.grade ?? ''}`}
              value={`paid ${inr(s.purchasePrice)}, sold ${inr(s.salePrice)}${s.repairCost ? `, repairs ${inr(s.repairCost)}` : ''}`} />
          ))}
      </Card>
    </View>
  );
}

// ------------------------------------------------------------------------------------------------ repair costs

function RepairCosts() {
  const client = useQueryClient();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('smartphone');
  const costs = useRepairCosts(category);
  const [brandId, setBrandId] = useState('');
  const [modelId, setModelId] = useState('');
  const [part, setPart] = useState('display');
  const [cost, setCost] = useState('');
  const [source, setSource] = useState<(typeof SOURCES)[number]>('official');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const add = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await pricingEngineApi.saveRepairCosts({
        category, part, cost: Number(cost), source, brandId: brandId.trim() || undefined, modelId: modelId.trim() || undefined,
        sourceUrl: url.trim() || undefined,
      });
      setMessage({ tone: 'success', text: 'Saved. Quotes for matching devices use it at once.' });
      setCost('');
      await client.invalidateQueries({ queryKey: engineKeys.repairCosts(category) });
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    try {
      await pricingEngineApi.deleteRepairCost(id);
      await client.invalidateQueries({ queryKey: engineKeys.repairCosts(category) });
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e) });
    }
  };

  return (
    <View style={styles.stack}>
      <Chips options={CATEGORIES.map(c => ({ id: c, label: c }))} value={category} onChange={setCategory} />
      <Card title="Add a repair price">
        <Text style={styles.muted}>
          "Official": a brand's price list (Apple, Samsung, Xiaomi publish them for India); the engine counts 75% of it.
          "Admin": what Fonzkart itself pays. Leave the model empty for the whole brand, and both empty for the category.
        </Text>
        <Chips options={SOURCES.map(s => ({ id: s, label: s }))} value={source} onChange={setSource} />
        <Chips options={Object.entries(PART_LABELS).map(([id, label]) => ({ id, label }))} value={part} onChange={setPart} />
        <Field label="Brand id (apple, samsung…)" value={brandId} onChange={setBrandId} />
        <Field label="Model id (from the catalog)" value={modelId} onChange={setModelId} />
        <NumberField label="Cost (₹)" value={cost} onChange={setCost} />
        <Field label="Source link" value={url} onChange={setUrl} />
        <Button title="Save" onPress={add} loading={busy} disabled={!cost} />
        {message ? <Notice tone={message.tone} text={message.text} /> : null}
      </Card>
      <Card title="On file">
        {costs.isPending ? <Loading /> : costs.isError ? <ErrorState onRetry={() => void costs.refetch()} />
          : !costs.data.length ? <Text style={styles.muted}>None yet: repairs are priced from each model's launch price until you add some.</Text>
          : costs.data.map(r => (
            <View key={r.id} style={styles.inline}>
              <Text style={styles.partLabel}>
                {PART_LABELS[r.part] ?? r.part} · {r.modelId || r.brandId || 'all'} · {r.source}
              </Text>
              <Text style={styles.change}>{inr(r.cost)}</Text>
              <Pressable onPress={() => void remove(r.id)} accessibilityRole="button" accessibilityLabel="Remove">
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          ))}
      </Card>
    </View>
  );
}

// ------------------------------------------------------------------------------------------------ small parts

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} autoCapitalize="none" placeholderTextColor={colors.muted} />
    </View>
  );
}

function NumberField({ label, value, onChange, onSave }: { label: string; value: string; onChange: (v: string) => void; onSave?: () => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inline}>
        <TextInput style={[styles.input, { flex: 1 }]} value={value} keyboardType="decimal-pad"
          onChangeText={t => onChange(t.replace(/[^\d.]/g, ''))} onSubmitEditing={onSave} placeholderTextColor={colors.muted} />
        {onSave ? <Button title="Save" variant="secondary" onPress={onSave} /> : null}
      </View>
    </View>
  );
}

function Chips<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.chips}>
      {options.map(o => (
        <Pressable key={o.id} onPress={() => onChange(o.id)} accessibilityRole="button" accessibilityState={{ selected: o.id === value }}
          style={[styles.chip, o.id === value && styles.chipOn]}>
          <Text style={[styles.chipText, o.id === value && styles.chipTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  stack: { gap: spacing.md },
  muted: { fontSize: font.small, color: colors.muted },
  body: { fontSize: font.body, color: colors.text },
  footnote: { fontSize: font.tiny, color: colors.muted, textAlign: 'center' },
  label: { fontSize: font.small, fontWeight: '600', color: colors.textSoft },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'space-between' },
  change: { fontSize: font.small, fontWeight: '700', color: colors.navy },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  field: { gap: 4 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 8,
    fontSize: font.body, color: colors.text, backgroundColor: colors.surface,
  },
  smallInput: {
    width: 96, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 6,
    fontSize: font.body, color: colors.text, textAlign: 'right', backgroundColor: colors.surface,
  },
  partLabel: { flex: 1, fontSize: font.small, color: colors.text },
  remove: { fontSize: font.small, color: colors.danger, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.greenTint, borderColor: colors.green },
  chipText: { fontSize: font.small, color: colors.textSoft, textTransform: 'capitalize' },
  chipTextOn: { color: colors.greenDark, fontWeight: '700' },
});
