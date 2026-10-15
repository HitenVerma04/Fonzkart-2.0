// Cities (the website's Cities Workspace): register a hub city, its pickup pincodes, whether it is live, and whether
// it is featured on the website's home page. Zonal heads see and change only their own cities (server rule).
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { adminApi, useCitiesOverview, type CityWithUsers } from '@fonzkart/api';
import { Button, Card, EmptyState, ErrorState, Loading, Notice, TextField, TextPrompt, colors, font, spacing } from '@fonzkart/ui';

export default function Cities() {
  const client = useQueryClient();
  const data = useCitiesOverview();
  const [newCity, setNewCity] = useState('');
  const [editing, setEditing] = useState<CityWithUsers | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  if (data.isPending) return <Loading />;
  if (data.isError) return <ErrorState message="Could not load cities." onRetry={() => data.refetch()} />;

  const run = async (task: () => Promise<unknown>, done: string) => {
    setMessage(null);
    try {
      await task();
      setMessage({ tone: 'success', text: done });
      await client.invalidateQueries({ queryKey: ['staff'] });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  };

  return (
    <>
      <FlatList
        data={data.data.cities}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={data.isRefetching} onRefresh={() => void data.refetch()} />}
        ListHeaderComponent={
          <View style={styles.head}>
            {!data.data.isZonalHead ? (
              <Card title="Register a hub city">
                <TextField label="City name" value={newCity} onChangeText={setNewCity} />
                <Button title="Register" disabled={!newCity.trim()}
                  onPress={() => void run(() => adminApi.registerHub(newCity.trim()), `${newCity.trim()} registered.`).then(() => setNewCity(''))} />
              </Card>
            ) : null}
            {message ? <Notice tone={message.tone} text={message.text} /> : null}
          </View>
        }
        ListEmptyComponent={<EmptyState message="No cities yet." />}
        renderItem={({ item: c }) => (
          <Card title={c.name}>
            <View style={styles.toggle}>
              <Text style={styles.label}>Live (customers can book)</Text>
              <Switch value={c.isActive} trackColor={{ true: colors.green }}
                onValueChange={v => void run(() => adminApi.setCityActive(c.id, v), `${c.name} is ${v ? 'live' : 'paused'}.`)} />
            </View>
            {!data.data.isZonalHead ? (
              <View style={styles.toggle}>
                <Text style={styles.label}>Featured on the home page</Text>
                <Switch value={c.isFeatured} trackColor={{ true: colors.green }}
                  onValueChange={v => void run(() => adminApi.setCityFeatured(c.id, v), `${c.name} ${v ? 'featured' : 'no longer featured'}.`)} />
              </View>
            ) : null}
            <Text style={styles.muted}>Pincodes: {c.pincodes.join(', ') || 'none'}</Text>
            <Text style={styles.muted}>
              Zonal heads: {c.zonalHeads.map(z => z.name).join(', ') || 'none'} · Partners: {c.partners.map(p => p.name).join(', ') || 'none'}
            </Text>
            <Button title="Edit pincodes" variant="secondary" onPress={() => setEditing(c)} />
          </Card>
        )}
      />
      <TextPrompt
        visible={editing !== null}
        title={`Pincodes of ${editing?.name ?? ''}`}
        message={`Now: ${editing?.pincodes.join(', ') || 'none'}. Enter the full list, separated by commas.`}
        label="Pincodes"
        confirmLabel="Save"
        onClose={() => setEditing(null)}
        onSubmit={text => {
          const c = editing!;
          setEditing(null);
          const pincodes = [...new Set(text.split(/[\s,]+/).filter(x => /^\d{6}$/.test(x)))];
          void run(() => adminApi.setCityPincodes(c.id, pincodes), `Pincodes of ${c.name} saved.`);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, maxWidth: 900, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.md, marginBottom: spacing.xs },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: font.body, color: colors.text },
  muted: { fontSize: font.small, color: colors.muted },
});
