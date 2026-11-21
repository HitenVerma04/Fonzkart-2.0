// Zonal heads (admins only): create a zonal head account and assign or remove the cities they manage.
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { adminApi, useCitiesOverview, useZonalHeads, type ActionResult, type ZonalHead } from '@fonzkart/api';
import { cleanPhone, displayPhone, emailProblem, nameProblem, passwordProblem, phoneProblem } from '@fonzkart/core';
import { Button, Card, EmptyState, ErrorState, ListPicker, Loading, Notice, TextField, colors, font, spacing } from '@fonzkart/ui';

export default function ZonalHeads() {
  const client = useQueryClient();
  const heads = useZonalHeads();
  const cities = useCitiesOverview();
  const [assignTo, setAssignTo] = useState<ZonalHead | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [tried, setTried] = useState(false);
  const errors = {
    name: nameProblem(form.name),
    email: emailProblem(form.email),
    phone: phoneProblem(form.phone, { required: false }),
    password: passwordProblem(form.password),
  };
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  if (heads.isPending || cities.isPending) return <Loading />;
  if (heads.isError || cities.isError) return <ErrorState onRetry={() => { void heads.refetch(); void cities.refetch(); }} />;

  const run = async (task: () => Promise<ActionResult | void>, done: string) => {
    setMessage(null);
    try {
      const r = await task();
      if (r && r.error) {
        setMessage({ tone: 'error', text: r.error });
        return false;
      }
      setMessage({ tone: 'success', text: done });
      await client.invalidateQueries({ queryKey: ['staff'] });
      return true;
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Something went wrong. Please try again.' });
      return false;
    }
  };

  // The form keeps what was typed when creating fails, so it can be corrected.
  const create = () => run(() => adminApi.createZonalHead({
    name: form.name.trim(), email: form.email.trim(), phone: form.phone ? `+91${form.phone}` : '', password: form.password,
  }), `${form.name.trim()} created.`).then(ok => { if (ok) setForm({ name: '', email: '', phone: '', password: '' }); });

  return (
    <>
      <FlatList
        data={heads.data}
        keyExtractor={z => z.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={heads.isRefetching} onRefresh={() => void heads.refetch()} />}
        ListHeaderComponent={
          <View style={styles.head}>
            <Card title="Create a zonal head">
              <TextField label="Name" value={form.name} onChangeText={name => setForm(f => ({ ...f, name }))}
                error={errors.name} showError={tried} />
              <TextField label="Email" value={form.email} onChangeText={email => setForm(f => ({ ...f, email: email.trim() }))} autoCapitalize="none"
                keyboardType="email-address" error={errors.email} showError={tried} />
              <TextField label="Phone (optional)" value={form.phone} onChangeText={phone => setForm(f => ({ ...f, phone: cleanPhone(phone) }))}
                keyboardType="phone-pad" prefix="+91" error={errors.phone} showError={tried} />
              <TextField label="First password" value={form.password} onChangeText={password => setForm(f => ({ ...f, password }))} secureTextEntry
                error={errors.password} showError={tried} hint="At least 6 characters." />
              <Button title="Create" onPress={() => {
                setTried(true);
                if (!Object.values(errors).some(Boolean)) void create().then(() => setTried(false));
              }} />
            </Card>
            {message ? <Notice tone={message.tone} text={message.text} /> : null}
          </View>
        }
        ListEmptyComponent={<EmptyState message="No zonal heads yet." />}
        renderItem={({ item: z }) => (
          <Card title={z.name}>
            <Text style={styles.muted}>{[z.email, z.phone ? displayPhone(z.phone) : null].filter(Boolean).join(' · ')}</Text>
            <Text style={styles.label}>Cities</Text>
            {z.managedCities.length ? z.managedCities.map(c => (
              <View key={c.id} style={styles.cityRow}>
                <Text style={styles.city}>{c.name}</Text>
                <Button title="Remove" variant="link"
                  onPress={() => void run(() => adminApi.unassignCity(z.id, c.id), `${c.name} removed from ${z.name}.`)} />
              </View>
            )) : <Text style={styles.muted}>None yet</Text>}
            <Button title="Assign a city" variant="secondary" onPress={() => setAssignTo(z)} />
            <Text style={styles.muted}>Partners: {z.managedUsers.map(u => u.name).join(', ') || 'none'}</Text>
          </Card>
        )}
      />
      <ListPicker
        visible={assignTo !== null}
        title="Assign a city"
        items={cities.data.cities}
        keyOf={c => c.id}
        labelOf={c => c.name}
        onClose={() => setAssignTo(null)}
        onPick={c => {
          const z = assignTo!;
          setAssignTo(null);
          void run(() => adminApi.assignCity(z.id, c.id), `${c.name} assigned to ${z.name}.`);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, maxWidth: 900, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.md, marginBottom: spacing.xs },
  label: { fontSize: font.small, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  muted: { fontSize: font.small, color: colors.muted },
  cityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  city: { fontSize: font.body, color: colors.text },
});
