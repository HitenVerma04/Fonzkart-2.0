// Festive theme: one look at a time for the Customer app (Republic Day, Independence Day, Eid, Diwali, Christmas), or
// its normal green. The Customer app reads the choice from the backend, so it shows within a minute or when the app is
// reopened, and it stays on until it is changed here.
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { FESTIVE_THEMES, festiveApi, festiveKeys, useFestiveTheme, type FestiveThemeId } from '@fonzkart/api';
import { Button, Card, ErrorState, Loading, Notice, colors, font, spacing } from '@fonzkart/ui';

const CHOICES: { id: FestiveThemeId; label: string; when: string; colors: readonly string[] }[] = [
  { id: 'none', label: 'Normal Fonzkart green', when: 'No festive theme', colors: ['#0f7a37', '#16a34a', '#bbf7d0'] },
  ...FESTIVE_THEMES,
];

export default function FestiveThemeEditor() {
  const client = useQueryClient();
  const theme = useFestiveTheme();
  const [busy, setBusy] = useState<FestiveThemeId | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  if (theme.isPending) return <Loading />;
  if (theme.isError) return <ErrorState onRetry={() => theme.refetch()} />;
  const current = theme.data?.theme ?? 'none';

  const choose = async (id: FestiveThemeId, label: string) => {
    setBusy(id);
    setMessage(null);
    try {
      const r = await festiveApi.set(id);
      if (r.error) setMessage({ tone: 'error', text: r.error });
      else {
        await client.invalidateQueries({ queryKey: festiveKeys.theme });
        setMessage({
          tone: 'success',
          text: id === 'none' ? 'The Customer app is back to normal green.' : `${label} is on. Customers see it within a minute or when they reopen the app.`,
        });
      }
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={theme.isRefetching} onRefresh={() => void theme.refetch()} />}>
      <Text style={styles.muted}>Changes the Customer app for everyone: colours, the home header decorations and a greeting. It stays on until you change it here.</Text>
      {message ? <Notice tone={message.tone} text={message.text} /> : null}
      {CHOICES.map(choice => {
        const on = choice.id === current;
        return (
          <Card key={choice.id}>
            <View style={styles.swatch} accessible={false}>
              {choice.colors.map(c => <View key={c} style={[styles.band, { backgroundColor: c }]} />)}
            </View>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.label}>{choice.label}</Text>
                <Text style={styles.muted}>{choice.when}</Text>
              </View>
              {on ? (
                <Text style={styles.live}>On now</Text>
              ) : (
                <Button title={choice.id === 'none' ? 'Switch back' : 'Turn on'} variant="secondary" disabled={!!busy} loading={busy === choice.id}
                  onPress={() => void choose(choice.id, choice.label)} />
              )}
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  swatch: { flexDirection: 'row', height: 34, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  band: { flex: 1 },
  label: { fontSize: font.body, fontWeight: '600', color: colors.navy },
  muted: { fontSize: font.small, color: colors.muted },
  live: { fontSize: font.body, fontWeight: '700', color: colors.green },
});
