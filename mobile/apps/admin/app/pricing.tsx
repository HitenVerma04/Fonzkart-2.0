// Pricing (admins only; the website's category pages too): how offers are worked out, the lowest offer, and the share
// of the max value that each answer takes. An answer takes its built-in share until an admin saves a rule for it;
// "Use built-in" removes the rule. Prices are only calculated on the server, so a change applies at once to every
// quote (website and apps).
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { adminApi, adminKeys, usePricingRules, usePricingSettings, useQuestionnaire, type EvaluationRule } from '@fonzkart/api';
import { pricingRuleRows, questionnaireCategory, type PricingRuleRow } from '@fonzkart/core';
import { Button, EmptyState, ErrorState, Loading, Notice, Segmented, colors, font, radius, spacing } from '@fonzkart/ui';

import { CATALOG_CATEGORIES as CATEGORIES } from '../src/catalogCategories';

type Message = { tone: 'success' | 'error'; text: string };

/** The most one answer can take (the server caps it there too). */
const MAX_SHARE = 90;

const HOW_IT_WORKS = [
  "A variant's max value is what a flawless device that works fully, with box and bill, gets. With a launch price it is kept current every month (Pricing engine).",
  "Repairs (cracked screen, dead camera, faulty port...) cost what that part costs for that model: official price lists, your repair prices and what resales taught, else the part's usual share of the launch price.",
  'Everything else (scratches, age, accessories, bought abroad) takes a share of the max value: the built-in share, or your rule once you save one.',
  'A rule for a repair answer is the least it takes: when the part costs more for a model, the repair cost is used.',
  'Answers on the same part are paid once; shares overlap and multiply. The offer never goes below the lowest offer or above the max value.',
];

const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function Pricing() {
  const [category, setCategory] = useState<string>('smartphone');
  const questionnaire = useQuestionnaire();
  const rules = usePricingRules(category);
  const settings = usePricingSettings(category);
  const [message, setMessage] = useState<Message | null>(null);
  const rows = useMemo(
    () => pricingRuleRows(questionnaire.data?.[questionnaireCategory(category)] ?? [], settings.data?.defaults ?? []),
    [questionnaire.data, category, settings.data],
  );

  if (questionnaire.isPending || rules.isPending || settings.isPending) return <Loading />;
  if (questionnaire.isError || rules.isError || settings.isError) {
    return <ErrorState onRetry={() => { void questionnaire.refetch(); void rules.refetch(); void settings.refetch(); }} />;
  }

  const builtIn = (row: PricingRuleRow) =>
    settings.data.defaults.find(d => d.questionKey === row.questionKey && d.answerKey === row.answerKey)?.percent ?? 0;
  const capNote = (row: PricingRuleRow, index: number) => {
    if (index > 0 && rows[index - 1]?.questionKey === row.questionKey) return undefined;
    const cap = settings.data.caps[row.questionKey];
    return cap !== undefined && cap < MAX_SHARE ? `Together these take at most ${pct(cap)}.` : undefined;
  };

  return (
    <FlatList
      data={rows}
      keyExtractor={r => `${r.questionKey}|${r.answerKey}`}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={rules.isRefetching || settings.isRefetching}
        onRefresh={() => { void rules.refetch(); void settings.refetch(); }} />}
      ListHeaderComponent={
        <View style={styles.head}>
          <Segmented value={category} onChange={c => { setCategory(c); setMessage(null); }}
            options={CATEGORIES.map(c => ({ id: c.id, label: c.label }))} />
          <View style={styles.card}>
            <Text style={styles.cardTitle}>How the offer is worked out</Text>
            {HOW_IT_WORKS.map((line, i) => <Text key={line} style={styles.how}>{i + 1}. {line}</Text>)}
          </View>
          <MinOffer value={settings.data.minOfferPercent} onMessage={setMessage} />
          <MaxValueCalculator category={category} />
          {message ? <Notice tone={message.tone} text={message.text} /> : null}
          <Text style={styles.muted}>Share of the max value per answer. A ₹ amount is taken on top of the percent.</Text>
        </View>
      }
      ListEmptyComponent={<EmptyState message="No questions for this category." />}
      renderItem={({ item, index }) => (
        <RuleRow category={category} row={item} builtIn={builtIn(item)} capNote={capNote(item, index)} onMessage={setMessage}
          rule={rules.data.find(r => r.questionKey === item.questionKey && r.answerKey === item.answerKey)} />
      )}
    />
  );
}

function MinOffer({ value, onMessage }: { value: number; onMessage: (m: Message) => void }) {
  const client = useQueryClient();
  const [text, setText] = useState(String(value));
  const [busy, setBusy] = useState(false);
  useEffect(() => setText(String(value)), [value]);
  const n = Number(text);
  const valid = text !== '' && Number.isFinite(n) && n >= 0 && n <= MAX_SHARE;

  const save = async () => {
    setBusy(true);
    try {
      const result = await adminApi.saveMinOffer(n);
      if (result.error) onMessage({ tone: 'error', text: result.error });
      else {
        onMessage({ tone: 'success', text: `Lowest offer saved: ${pct(n)} of the max value.` });
        await client.invalidateQueries({ queryKey: ['staff', 'pricing-settings'] });
      }
    } catch (e) {
      onMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Lowest offer</Text>
      <Text style={styles.muted}>No offer goes below this share of the max value, whatever the answers. It applies to every category.</Text>
      <View style={styles.inputs}>
        <Field label="% of max value" value={text} onChange={setText} />
        <View style={styles.save}><Button title="Save" loading={busy} disabled={!valid || n === value} onPress={() => void save()} /></View>
      </View>
      <Text style={styles.example}>
        {valid ? `A ₹50,000 phone never gets less than ${inr(50_000 * n / 100)}.` : `Enter 0 to ${MAX_SHARE}.`}
      </Text>
    </View>
  );
}

const BRANDS = [
  { id: 'apple', label: 'Apple' },
  { id: 'samsung', label: 'Samsung / Google / OnePlus' },
  { id: 'other', label: 'Other brands' },
];

/** What max value a variant should have: launch price × the share its kind of device keeps at its age (server rule). */
function MaxValueCalculator({ category }: { category: string }) {
  const [price, setPrice] = useState('');
  const [launched, setLaunched] = useState('');
  const [brand, setBrand] = useState('apple');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const valid = Number(price) > 0 && /^\d{4}-(0[1-9]|1[0-2])$/.test(launched);

  const workOut = async () => {
    setBusy(true);
    try {
      const s = await adminApi.maxValue({ launchPrice: Number(price), launched, category, brand });
      setResult(s ? { ok: true, text: `Max value ${inr(s.maxValue)}: keeps ${pct(s.keptPercent)} of the launch price at ${s.ageMonths} month${s.ageMonths === 1 ? '' : 's'} old.` }
        : { ok: false, text: 'No answer from the server.' });
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : 'Could not work it out.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Max value from the launch price</Text>
      <Text style={styles.muted}>For a new model or variant: the launch price in India and the launch month give its max value, lower as it gets older. Apple keeps value best, then Samsung, Google and OnePlus.</Text>
      <Segmented value={brand} onChange={b => { setBrand(b); setResult(null); }} options={BRANDS} />
      <View style={styles.inputs}>
        <Field label="Launch price (₹)" value={price} onChange={v => { setPrice(v.replace(/\D/g, '')); setResult(null); }} />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Launched (YYYY-MM)</Text>
          <TextInput value={launched} onChangeText={t => { setLaunched(t.replace(/[^\d-]/g, '').slice(0, 7)); setResult(null); }}
            placeholder="2025-09" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel="Launched, year and month" />
        </View>
        <View style={styles.save}><Button title="Work out" loading={busy} disabled={!valid || busy} onPress={() => void workOut()} /></View>
      </View>
      {result ? <Text style={result.ok ? styles.example : styles.error}>{result.text}</Text> : null}
    </View>
  );
}

function RuleRow({ category, row, rule, builtIn, capNote, onMessage }: {
  category: string;
  row: PricingRuleRow;
  rule: EvaluationRule | undefined;
  builtIn: number;
  capNote: string | undefined;
  onMessage: (m: Message) => void;
}) {
  const client = useQueryClient();
  const percentNow = rule ? rule.deductionPercent : builtIn;
  const amountNow = rule ? rule.deductionAmount : 0;
  const [percent, setPercent] = useState(String(percentNow));
  const [amount, setAmount] = useState(String(amountNow));
  const [busy, setBusy] = useState<'save' | 'reset' | null>(null);
  useEffect(() => {
    setPercent(String(percentNow));
    setAmount(String(amountNow));
  }, [percentNow, amountNow]);

  const changed = percent !== String(percentNow) || amount !== String(amountNow);
  const refresh = () => client.invalidateQueries({ queryKey: adminKeys.rules(category) });

  const save = async () => {
    const p = Number(percent) || 0;
    if (p > MAX_SHARE) {
      onMessage({ tone: 'error', text: `One answer can take at most ${MAX_SHARE}% of the max value.` });
      return;
    }
    setBusy('save');
    try {
      const result = await adminApi.upsertRule({
        category, questionKey: row.questionKey, answerKey: row.answerKey, label: `${row.questionLabel}: ${row.answerLabel}`,
        deductionAmount: Math.round(Number(amount) || 0), deductionPercent: p,
      });
      if (result.error) onMessage({ tone: 'error', text: result.error });
      else {
        onMessage({ tone: 'success', text: `Saved: ${row.answerLabel}.` });
        await refresh();
      }
    } catch (e) {
      onMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(null);
    }
  };

  const restoreBuiltIn = async () => {
    setBusy('reset');
    try {
      const result = await adminApi.deleteRule(category, row.questionKey, row.answerKey);
      if (result.error) onMessage({ tone: 'error', text: result.error });
      else {
        onMessage({ tone: 'success', text: `${row.answerLabel}: back to the built-in ${pct(builtIn)}.` });
        await refresh();
      }
    } catch (e) {
      onMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not change it.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.row}>
      <Text style={styles.question}>{row.questionLabel}</Text>
      <View style={styles.answerLine}>
        <Text style={styles.answer}>{row.answerLabel}</Text>
        <Text style={[styles.badge, rule ? styles.badgeRule : null]}>{rule ? 'Your rule' : `Built-in ${pct(builtIn)}`}</Text>
      </View>
      {capNote ? <Text style={styles.muted}>{capNote}</Text> : null}
      <View style={styles.inputs}>
        <Field label="% of max value" value={percent} onChange={setPercent} />
        <Field label="+ ₹ amount" value={amount} onChange={setAmount} />
        <View style={styles.save}><Button title="Save" loading={busy === 'save'} disabled={!changed || busy !== null} onPress={() => void save()} /></View>
      </View>
      {rule ? (
        <Pressable onPress={() => void restoreBuiltIn()} disabled={busy !== null} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>{busy === 'reset' ? 'Changing…' : `Use built-in (${pct(builtIn)})`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={t => onChange(t.replace(/[^\d.]/g, ''))} keyboardType="numeric" style={styles.input}
        accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, maxWidth: 900, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.sm, marginBottom: spacing.xs },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 6 },
  cardTitle: { fontSize: font.body, fontWeight: '800', color: colors.text },
  how: { fontSize: font.small, color: colors.text, lineHeight: 20 },
  example: { fontSize: font.small, color: colors.greenDark, fontWeight: '700' },
  muted: { fontSize: font.small, color: colors.muted },
  row: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4 },
  question: { fontSize: font.tiny, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  answerLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  answer: { flex: 1, fontSize: font.body, fontWeight: '700', color: colors.text },
  badge: { fontSize: font.tiny, fontWeight: '700', color: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  badgeRule: { color: colors.greenDark, borderColor: colors.green },
  inputs: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  field: { flex: 1, gap: 2 },
  fieldLabel: { fontSize: font.tiny, color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 8, fontSize: font.body, color: colors.text },
  save: { width: 90 },
  link: { fontSize: font.small, fontWeight: '700', color: colors.greenDark, marginTop: 2 },
  error: { fontSize: font.small, color: colors.danger, fontWeight: '700' },
});
