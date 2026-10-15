// Field executives (the website's Field Executives page): partners manage their own team; zonal heads and admins
// choose the partner. A new executive signs in to the Partner app with this phone number and sets a password.
import { useState } from 'react';
import { Alert, FlatList, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ridersApi, useRidersOverview, type TeamRider } from '@fonzkart/api';
import { displayPhone, isCompleted, isFailed } from '@fonzkart/core';
import { Button, Card, EmptyState, ErrorState, ListPicker, Loading, Notice, TextField, colors, font, radius, spacing } from '@fonzkart/ui';

export function TeamManager() {
  const client = useQueryClient();
  const overview = useRidersOverview(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  if (overview.isPending) return <Loading />;
  if (overview.isError) return <ErrorState message="Could not load your team." onRetry={() => overview.refetch()} />;

  const { riders, partners, currentUserRole, currentUserId } = overview.data;
  const isPartner = currentUserRole === 'PARTNER';
  const chosenPartner = isPartner ? currentUserId : partnerId;
  const partnerName = (id: string | null) => partners.find(p => p.id === id)?.name;

  const refresh = () => client.invalidateQueries({ queryKey: ['staff'] });
  const run = async (task: () => Promise<{ success?: boolean; error?: string }>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await task();
      if (result.error) setMessage({ tone: 'error', text: result.error });
      else {
        setMessage({ tone: 'success', text: done });
        await refresh();
      }
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  };

  const add = () => run(async () => {
    const result = await ridersApi.add({ name: name.trim(), phone: `+91${phone}`, email: email.trim() || undefined, partnerId: chosenPartner ?? undefined });
    if (!result.error) { setName(''); setPhone(''); setEmail(''); }
    return result;
  }, `${name.trim()} added. They sign in to the Partner app with +91 ${phone}.`);

  const remove = (r: TeamRider) => {
    const go = () => void run(() => ridersApi.remove(r.id), `${r.name} removed.`);
    const text = `Remove ${r.name}? Their open orders stay and can be given to someone else.`;
    if (Platform.OS === 'web') {
      if ((globalThis as { confirm?: (t: string) => boolean }).confirm?.(text)) go();
    } else {
      Alert.alert('Remove executive', text, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: go }]);
    }
  };

  return (
    <FlatList
      data={riders}
      keyExtractor={r => r.id}
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={overview.isRefetching} onRefresh={() => void overview.refetch()} />}
      ListHeaderComponent={
        <View style={styles.head}>
          <Card title="Add a field executive">
            <TextField label="Name" value={name} onChangeText={setName} />
            <TextField label="Mobile number" value={phone} onChangeText={t => setPhone(t.replace(/\D/g, '').slice(0, 10))}
              keyboardType="phone-pad" prefix="+91" />
            <TextField label="Email (optional)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            {!isPartner ? (
              <Button title={chosenPartner ? `Partner: ${partnerName(chosenPartner)}` : 'Choose partner'} variant="secondary" onPress={() => setPicking(true)} />
            ) : null}
            <Button title="Add executive" loading={busy} disabled={!name.trim() || phone.length !== 10 || (!isPartner && currentUserRole !== 'ZONAL_HEAD' && !chosenPartner)}
              onPress={() => void add()} />
          </Card>
          {message ? <Notice tone={message.tone} text={message.text} /> : null}
          <Text style={styles.count}>{riders.length} field executive{riders.length === 1 ? '' : 's'}</Text>
        </View>
      }
      ListEmptyComponent={<EmptyState message="No field executives yet." />}
      renderItem={({ item }) => {
        const open = item.orders.filter(o => !isCompleted(o.status) && !isFailed(o.status)).length;
        return (
          <View style={styles.rider}>
            <View style={styles.riderText}>
              <Text style={styles.riderName}>{item.name}</Text>
              <Text style={styles.muted}>{[displayPhone(item.phone), item.partner?.name].filter(Boolean).join(' · ')}</Text>
              <Text style={styles.muted}>{open} open pickup{open === 1 ? '' : 's'} · {item.orders.length} in total</Text>
            </View>
            <Button title="Remove" variant="link" onPress={() => remove(item)} />
          </View>
        );
      }}
      ListFooterComponent={
        <ListPicker visible={picking} title="Choose the partner" items={partners} keyOf={p => p.id} labelOf={p => p.name}
          detailOf={p => p.email} onClose={() => setPicking(false)} onPick={p => { setPartnerId(p.id); setPicking(false); }} />
      }
    />
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, gap: spacing.sm, maxWidth: 720, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.md, marginBottom: spacing.sm },
  count: { fontSize: font.small, fontWeight: '700', color: colors.muted },
  rider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  riderText: { flex: 1, gap: 2 },
  riderName: { fontSize: font.body, fontWeight: '700', color: colors.text },
  muted: { fontSize: font.small, color: colors.muted },
});
