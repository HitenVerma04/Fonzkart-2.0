// Partners (the website's Partners page): register a partner, upgrade an existing account, and set each partner's
// city, zonal head, relationship manager and pickup pincodes. The server limits zonal heads and RMs (who may change
// what), exactly as on the website. The list shows one card per partner; tapping it opens the partner's details
// (contact, territory, service areas, field executives) and the buttons to change them, and tapping again closes it.
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { adminApi, usePartnersOverview, useRidersOverview, useSession, type ActionResult, type PartnerOverviewItem, type TeamRider } from '@fonzkart/api';
import { displayPhone } from '@fonzkart/core';
import { PincodeEditor } from '../src/PincodeEditor';
import { Button, Card, EmptyState, ErrorState, InfoRow, ListPicker, Loading, Notice, SearchField, Segmented, TextField, colors, font, formatDateTime, radius, spacing } from '@fonzkart/ui';

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
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  // Field executives per partner (the Field executives page's data), for the details.
  const riders = useRidersOverview(true);
  const team = useMemo(() => {
    const byPartner = new Map<string, TeamRider[]>();
    for (const r of riders.data?.riders ?? []) {
      if (r.partnerId) byPartner.set(r.partnerId, [...(byPartner.get(r.partnerId) ?? []), r]);
    }
    return byPartner;
  }, [riders.data]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = data.data?.partners ?? [];
    return q ? all.filter(p => [p.name, p.email, p.phone, p.city?.name, p.manager?.name, p.relationshipManager?.name, ...p.pincodes]
      .some(v => v?.toLowerCase().includes(q))) : all;
  }, [data.data, query]);

  if (data.isPending) return <Loading />;
  if (data.isError) return <ErrorState message="Could not load partners." onRetry={() => data.refetch()} />;
  const { partners, zonalHeads, availableCities, relationshipManagers } = data.data;
  const role = session.status === 'signedIn' ? session.user.role : '';

  /** Runs one change and says how it went; true when it worked. */
  const run = async (task: () => Promise<ActionResult | void>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await task();
      if (result && result.error) {
        setMessage({ tone: 'error', text: result.error });
        return false;
      }
      setMessage({ tone: 'success', text: done });
      await client.invalidateQueries({ queryKey: ['staff'] });
      return true;
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Something went wrong. Please try again.' });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: string) => setOpen(now => {
    const next = new Set(now);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

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
      {mode === 'list' && partners.length > 3 ? (
        <SearchField placeholder="Search name, city, pincode, manager" value={query} onChangeText={setQuery} />
      ) : null}
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
            }), `${form.name.trim()} registered as a partner.`).then(ok => {
              if (!ok) return;
              setForm({ name: '', email: '', phone: '', password: '', cityId: '' });
              setMode('list');
            })} />
        </Card>
      ) : null}
      {mode === 'upgrade' ? <UpgradeForm busy={busy} onSubmit={(email, cityId) => void run(() => adminApi.grantPartner(email, cityId), `${email} is now a partner.`)}
        cities={availableCities} /> : null}
    </View>
  );

  return (
    <>
      <FlatList
        data={mode === 'list' ? shown : []}
        // Redraw the cards when one opens or closes, or the executives arrive (they are not part of \`data\`).
        extraData={[open, team, riders.isPending]}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={data.isRefetching} onRefresh={() => void data.refetch()} />}
        ListHeaderComponent={header}
        ListEmptyComponent={mode === 'list'
          ? <EmptyState message={query.trim() ? `No partner matches "${query.trim()}".` : 'No partners yet. Add one under New partner.'} />
          : undefined}
        renderItem={({ item: p }) => {
          const expanded = open.has(p.id);
          const executives = team.get(p.id) ?? [];
          const missing = [!p.city && 'no city', !p.pincodes.length && 'no service areas'].filter(Boolean).join(' · ');
          return (
            <View style={[styles.partner, expanded && styles.partnerOpen]}>
              <Pressable onPress={() => toggle(p.id)} style={styles.summary} accessibilityRole="button"
                accessibilityState={{ expanded }} accessibilityLabel={`${p.name}. ${expanded ? 'Tap to close' : 'Tap for details'}`}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{p.name.trim().charAt(0).toUpperCase() || '?'}</Text></View>
                <View style={styles.flex}>
                  <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {p.city?.name ?? 'No city'} · {p.pincodes.length} pincode{p.pincodes.length === 1 ? '' : 's'} · {executives.length} executive{executives.length === 1 ? '' : 's'}
                  </Text>
                  {missing ? <Text style={styles.warn}>Needs {missing}</Text> : null}
                </View>
                <Text style={[styles.chevron, expanded && styles.chevronOpen]}>›</Text>
              </Pressable>
              {expanded ? (
                <View style={styles.details}>
                  <InfoRow label="Email" value={p.email} />
                  <InfoRow label="Phone" value={p.phone ? displayPhone(p.phone) : null} />
                  <InfoRow label="Partner since" value={formatDateTime(p.createdAt)} />
                  <InfoRow label="City" value={p.city ? `${p.city.name}${p.city.isActive ? '' : ' (paused)'}` : null} />
                  <InfoRow label="Zonal head" value={p.manager?.name} />
                  <InfoRow label="Relationship manager" value={p.relationshipManager?.name} />
                  <Text style={styles.subhead}>Service areas ({p.pincodes.length})</Text>
                  {p.pincodes.length ? (
                    <View style={styles.chips}>
                      {p.pincodes.map(code => <Text key={code} style={styles.chip}>{code}</Text>)}
                    </View>
                  ) : <Text style={styles.muted}>None yet: this partner gets no new orders until pincodes are added.</Text>}
                  <Text style={styles.subhead}>Field executives ({executives.length})</Text>
                  {executives.length ? executives.map(r => {
                    const active = r.orders.filter(o => !/completed|cancel|fail|reject/i.test(o.status)).length;
                    return (
                      <Text key={r.id} style={styles.muted}>
                        {r.name} · {displayPhone(r.phone)} · {r.status.toLowerCase()}{active ? ` · ${active} active order${active === 1 ? '' : 's'}` : ''}
                      </Text>
                    );
                  }) : <Text style={styles.muted}>{riders.isPending ? 'Loading…' : 'None yet. Add them under Field executives.'}</Text>}
                  <View style={styles.buttons}>
                    <Button title="City" variant="secondary" onPress={() => setPick({ partner: p, field: 'city' })} />
                    {role !== 'ZONAL_HEAD' ? <Button title="Zonal head" variant="secondary" onPress={() => setPick({ partner: p, field: 'manager' })} /> : null}
                    {role !== 'RELATIONSHIP_MANAGER' ? <Button title="RM" variant="secondary" onPress={() => setPick({ partner: p, field: 'rm' })} /> : null}
                    <Button title="Service areas" variant="secondary" onPress={() => setPincodesFor(p)} />
                  </View>
                </View>
              ) : null}
            </View>
          );
        }}
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
      <PincodeEditor
        visible={pincodesFor !== null}
        title={`Service areas of ${pincodesFor?.name ?? ''}`}
        note={pincodesFor?.city
          ? `New orders in these pincodes go to this partner. Only ${pincodesFor.city.name}'s pincodes can be added.`
          : 'New orders in these pincodes go to this partner. Give the partner a city to use Add all.'}
        initial={pincodesFor?.pincodes ?? []}
        master={pincodesFor?.city ? pincodesFor.city.pincodes : undefined}
        onClose={() => setPincodesFor(null)}
        onSave={pincodes => {
          const p = pincodesFor!;
          setPincodesFor(null);
          void run(() => adminApi.updatePartnerPincodes(p.id, pincodes), `Service areas of ${p.name} saved (${pincodes.length}).`);
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
  flex: { flex: 1 },
  partner: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  partnerOpen: { borderColor: colors.green },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: font.body, fontWeight: '800', color: colors.green },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text },
  warn: { fontSize: font.tiny, fontWeight: '700', color: colors.warning.text, marginTop: 2 },
  chevron: { fontSize: 26, color: colors.muted, transform: [{ rotate: '90deg' }] },
  chevronOpen: { transform: [{ rotate: '-90deg' }], color: colors.green },
  details: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  subhead: { fontSize: font.small, fontWeight: '800', color: colors.text, marginTop: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    fontSize: font.small, fontWeight: '700', color: colors.text, backgroundColor: colors.greenTint, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden',
  },
});
