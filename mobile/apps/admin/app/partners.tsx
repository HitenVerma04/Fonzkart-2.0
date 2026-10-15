// Partners (the website's Partners page): register a partner, upgrade an existing account, and set each partner's
// city, zonal head, relationship manager and pickup pincodes. The server limits zonal heads and RMs (who may change
// what), exactly as on the website.
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { adminApi, usePartnersOverview, useSession, type ActionResult, type PartnerOverviewItem } from '@fonzkart/api';
import { displayPhone } from '@fonzkart/core';
import { Button, Card, EmptyState, ErrorState, InfoRow, ListPicker, Loading, Notice, Segmented, TextField, TextPrompt, colors, font, spacing } from '@fonzkart/ui';

type Pick = { partner: PartnerOverviewItem; field: 'city' | 'manager' | 'rm' } | { partner: null; field: 'newCity' } | null;
type Mode = 'list' | 'create' | 'upgrade';

export default function Partners() {
  const client = useQueryClient();
  const { session } = useSession();
  const data = usePartnersOverview();
  const [mode, setMode] = useState<Mode>('list');
  const [pick, setPick] = useState<Pick>(null);
  const [pincodesFor, setPincodesFor] = useState<PartnerOverviewItem | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', cityId: '' });
  const [busy, setBusy] = useState(false);

  if (data.isPending) return <Loading />;
  if (data.isError) return <ErrorState message="Could not load partners." onRetry={() => data.refetch()} />;
  const { partners, zonalHeads, availableCities, relationshipManagers } = data.data;
  const role = session.status === 'signedIn' ? session.user.role : '';

  const run = async (task: () => Promise<ActionResult | void>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await task();
      if (result && result.error) setMessage({ tone: 'error', text: result.error });
      else {
        setMessage({ tone: 'success', text: done });
        await client.invalidateQueries({ queryKey: ['staff'] });
      }
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  };

  const assign = (p: PartnerOverviewItem, change: { cityId?: string | null; managerId?: string | null; relationshipManagerId?: string | null }) =>
    run(() => adminApi.updatePartnerAssignment(p.id, {
      cityId: 'cityId' in change ? change.cityId ?? 'none' : p.cityId ?? 'none',
      managerId: 'managerId' in change ? change.managerId ?? 'none' : p.managerId ?? 'none',
      relationshipManagerId: 'relationshipManagerId' in change ? change.relationshipManagerId ?? 'none' : p.relationshipManagerId ?? 'none',
    }), `${p.name} updated.`);

  const header = (
    <View style={styles.head}>
      <Segmented<Mode> value={mode} onChange={m => { setMode(m); setMessage(null); }} options={[
        { id: 'list', label: 'Partners', count: partners.length },
        { id: 'create', label: 'New partner' },
        { id: 'upgrade', label: 'Upgrade an account' },
      ]} />
      {message ? <Notice tone={message.tone} text={message.text} /> : null}
      {mode === 'create' ? (
        <Card title="Register a partner">
          <TextField label="Business or owner name" value={form.name} onChangeText={name => setForm(f => ({ ...f, name }))} />
          <TextField label="Email" value={form.email} onChangeText={email => setForm(f => ({ ...f, email }))} autoCapitalize="none" keyboardType="email-address" />
          <TextField label="Phone" value={form.phone} onChangeText={phone => setForm(f => ({ ...f, phone: phone.replace(/\D/g, '').slice(0, 10) }))} keyboardType="phone-pad" prefix="+91" />
          <TextField label="First password" value={form.password} onChangeText={password => setForm(f => ({ ...f, password }))} secureTextEntry
            hint="Share it with the partner privately; they can change it with Forgot password." />
          <Button title={form.cityId ? `City: ${availableCities.find(c => c.id === form.cityId)?.name}` : 'Choose city'} variant="secondary"
            onPress={() => setPick({ partner: null, field: 'newCity' })} />
          <Button title="Register partner" loading={busy} disabled={!form.name.trim() || !form.email.trim() || !form.password}
            onPress={() => void run(() => adminApi.createPartner({
              name: form.name.trim(), email: form.email.trim(), phone: form.phone ? `+91${form.phone}` : '', password: form.password,
              cityId: form.cityId || undefined,
            }), `${form.name.trim()} registered.`).then(() => setForm({ name: '', email: '', phone: '', password: '', cityId: '' }))} />
        </Card>
      ) : null}
      {mode === 'upgrade' ? <UpgradeForm busy={busy} onSubmit={(email, cityId) => void run(() => adminApi.grantPartner(email, cityId), `${email} is now a partner.`)}
        cities={availableCities} /> : null}
    </View>
  );

  return (
    <>
      <FlatList
        data={mode === 'list' ? partners : []}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={data.isRefetching} onRefresh={() => void data.refetch()} />}
        ListHeaderComponent={header}
        ListEmptyComponent={mode === 'list' ? <EmptyState message="No partners yet." /> : null}
        renderItem={({ item: p }) => (
          <Card title={p.name}>
            <InfoRow label="Contact" value={[p.email, p.phone ? displayPhone(p.phone) : null].filter(Boolean).join(' · ')} />
            <InfoRow label="City" value={p.city?.name} />
            <InfoRow label="Zonal head" value={p.manager?.name} />
            <InfoRow label="Relationship manager" value={p.relationshipManager?.name} />
            <InfoRow label="Pickup pincodes" value={p.pincodes.join(', ')} />
            <View style={styles.buttons}>
              <Button title="City" variant="secondary" onPress={() => setPick({ partner: p, field: 'city' })} />
              {role !== 'ZONAL_HEAD' ? <Button title="Zonal head" variant="secondary" onPress={() => setPick({ partner: p, field: 'manager' })} /> : null}
              {role !== 'RELATIONSHIP_MANAGER' ? <Button title="RM" variant="secondary" onPress={() => setPick({ partner: p, field: 'rm' })} /> : null}
              <Button title="Pincodes" variant="secondary" onPress={() => setPincodesFor(p)} />
            </View>
          </Card>
        )}
      />
      <ListPicker
        visible={pick !== null}
        title={pick?.field === 'manager' ? 'Zonal head' : pick?.field === 'rm' ? 'Relationship manager' : 'City'}
        items={[{ id: 'none', name: 'None' }, ...(pick?.field === 'manager' ? zonalHeads : pick?.field === 'rm' ? relationshipManagers : availableCities)]}
        keyOf={x => x.id}
        labelOf={x => x.name}
        onClose={() => setPick(null)}
        onPick={x => {
          const current = pick;
          setPick(null);
          const value = x.id === 'none' ? null : x.id;
          if (!current) return;
          if (current.field === 'newCity') setForm(f => ({ ...f, cityId: value ?? '' }));
          else if (current.field === 'city') void assign(current.partner, { cityId: value });
          else if (current.field === 'manager') void assign(current.partner, { managerId: value });
          else void assign(current.partner, { relationshipManagerId: value });
        }}
      />
      <TextPrompt
        visible={pincodesFor !== null}
        title={`Pincodes of ${pincodesFor?.name ?? ''}`}
        message={`Now: ${pincodesFor?.pincodes.join(', ') || 'none'}. Enter the full list, separated by commas; new orders in these pincodes go to this partner.`}
        label="Pincodes"
        placeholder="600001, 600002"
        confirmLabel="Save"
        onClose={() => setPincodesFor(null)}
        onSubmit={text => {
          const p = pincodesFor!;
          setPincodesFor(null);
          const pincodes = [...new Set(text.split(/[\s,]+/).filter(x => /^\d{6}$/.test(x)))];
          void run(() => adminApi.updatePartnerPincodes(p.id, pincodes), `Pincodes of ${p.name} saved.`);
        }}
      />
    </>
  );
}

function UpgradeForm({ busy, cities, onSubmit }: { busy: boolean; cities: { id: string; name: string }[]; onSubmit: (email: string, cityId?: string) => void }) {
  const [email, setEmail] = useState('');
  const [cityId, setCityId] = useState<string | undefined>();
  const [picking, setPicking] = useState(false);
  return (
    <Card title="Make an existing account a partner">
      <Text style={styles.muted}>The person signs up on the website or in the app first; then enter their email here.</Text>
      <TextField label="Account email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Button title={cityId ? `City: ${cities.find(c => c.id === cityId)?.name}` : 'Choose city (optional)'} variant="secondary" onPress={() => setPicking(true)} />
      <Button title="Make partner" loading={busy} disabled={!email.trim()} onPress={() => onSubmit(email.trim(), cityId)} />
      <ListPicker visible={picking} title="City" items={cities} keyOf={c => c.id} labelOf={c => c.name} onClose={() => setPicking(false)}
        onPick={c => { setCityId(c.id); setPicking(false); }} />
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, maxWidth: 900, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.md, marginBottom: spacing.xs },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  muted: { fontSize: font.small, color: colors.muted },
});
