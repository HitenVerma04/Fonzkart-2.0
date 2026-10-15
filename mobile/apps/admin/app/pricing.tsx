// Pricing rules (admins only; the website's category pages): for each answer that can lower the price, a fixed amount
// and/or a percentage of the base price. Saved rules take effect at once for every quote — website and apps — because
// prices are only calculated on the server.
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { adminApi, adminKeys, usePricingRules, useQuestionnaire, type EvaluationRule } from '@fonzkart/api';
import { pricingRuleRows, type PricingRuleRow } from '@fonzkart/core';
import { Button, EmptyState, ErrorState, Loading, Notice, Segmented, colors, font, radius, spacing } from '@fonzkart/ui';

// The website admin's inventory categories (AdminSidebar).
const CATEGORIES = [
  { id: 'smartphone', label: 'Phones' }, { id: 'tablet', label: 'Tablets' }, { id: 'watch', label: 'Watches' },
  { id: 'laptop', label: 'Laptops' }, { id: 'desktop', label: 'Desktops' }, { id: 'earbuds', label: 'Earbuds' },
  { id: 'console', label: 'Consoles' }, { id: 'smarttv', label: 'TVs' }, { id: 'camera', label: 'Cameras' },
] as const;

export default function Pricing() {
  const [category, setCategory] = useState<string>('smartphone');
  const questionnaire = useQuestionnaire();
  const rules = usePricingRules(category);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const rows = useMemo(() => pricingRuleRows(questionnaire.data?.[category] ?? []), [questionnaire.data, category]);

  if (questionnaire.isPending || rules.isPending) return <Loading />;
  if (questionnaire.isError || rules.isError) return <ErrorState onRetry={() => { void questionnaire.refetch(); void rules.refetch(); }} />;

  return (
    <FlatList
      data={rows}
      keyExtractor={r => `${r.questionKey}|${r.answerKey}`}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={rules.isRefetching} onRefresh={() => void rules.refetch()} />}
      ListHeaderComponent={
        <View style={styles.head}>
          <Segmented value={category} onChange={c => { setCategory(c); setMessage(null); }}
            options={CATEGORIES.map(c => ({ id: c.id, label: c.label }))} />
          <Text style={styles.muted}>Percent is taken from the base price; the amount is then deducted. 0 and 0 = no deduction.</Text>
          {message ? <Notice tone={message.tone} text={message.text} /> : null}
        </View>
      }
      ListEmptyComponent={<EmptyState message="No questions for this category." />}
      renderItem={({ item }) => (
        <RuleRow category={category} row={item} onMessage={setMessage}
          rule={rules.data.find(r => r.questionKey === item.questionKey && r.answerKey === item.answerKey)} />
      )}
    />
  );
}

function RuleRow({ category, row, rule, onMessage }: {
  category: string;
  row: PricingRuleRow;
  rule: EvaluationRule | undefined;
  onMessage: (m: { tone: 'success' | 'error'; text: string }) => void;
}) {
  const client = useQueryClient();
  const [amount, setAmount] = useState(String(rule?.deductionAmount ?? 0));
  const [percent, setPercent] = useState(String(rule?.deductionPercent ?? 0));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setAmount(String(rule?.deductionAmount ?? 0));
    setPercent(String(rule?.deductionPercent ?? 0));
  }, [rule?.deductionAmount, rule?.deductionPercent]);

  const changed = amount !== String(rule?.deductionAmount ?? 0) || percent !== String(rule?.deductionPercent ?? 0);
  const save = async () => {
    setBusy(true);
    try {
      const result = await adminApi.upsertRule({
        category, questionKey: row.questionKey, answerKey: row.answerKey, label: `${row.questionLabel}: ${row.answerLabel}`,
        deductionAmount: Math.round(Number(amount) || 0), deductionPercent: Number(percent) || 0,
      });
      if (result.error) onMessage({ tone: 'error', text: result.error });
      else {
        onMessage({ tone: 'success', text: `Saved: ${row.answerLabel}.` });
        await client.invalidateQueries({ queryKey: adminKeys.rules(category) });
      }
    } catch (e) {
      onMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.row}>
      <Text style={styles.question}>{row.questionLabel}</Text>
      <Text style={styles.answer}>{row.answerLabel}</Text>
      <View style={styles.inputs}>
        <Field label="₹ amount" value={amount} onChange={setAmount} />
        <Field label="% of base" value={percent} onChange={setPercent} />
        <View style={styles.save}><Button title="Save" loading={busy} disabled={!changed} onPress={() => void save()} /></View>
      </View>
    </View>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={t => onChange(t.replace(/[^\d.-]/g, ''))} keyboardType="numeric" style={styles.input}
        accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, maxWidth: 900, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.sm, marginBottom: spacing.xs },
  muted: { fontSize: font.small, color: colors.muted },
  row: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4 },
  question: { fontSize: font.tiny, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  answer: { fontSize: font.body, fontWeight: '700', color: colors.text },
  inputs: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  field: { flex: 1, gap: 2 },
  fieldLabel: { fontSize: font.tiny, color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 8, fontSize: font.body, color: colors.text },
  save: { width: 90 },
});
