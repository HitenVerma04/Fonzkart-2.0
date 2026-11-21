// Partners (the website's Partners page): register a partner, upgrade an existing account, and set what each partner
// is responsible for: the cities they serve (several; one is the main city), zonal head, relationship manager and
// pickup pincodes. The server limits zonal heads and RMs (who may change what), exactly as on the website. The list
// shows one card per partner; tapping it opens the partner's details with a "Responsibility" block where every item
// has its own Change button, and tapping again closes it.
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { adminApi, usePartnersOverview, useRidersOverview, useSession, type ActionResult, type City, type PartnerOverviewItem, type TeamRider } from '@fonzkart/api';
import { cleanPhone, displayPhone, emailProblem, nameProblem, passwordProblem, phoneProblem } from '@fonzkart/core';
import { Button, Card, EmptyState, ErrorState, InfoRow, ListPicker, Loading, Notice, SearchField, Segmented, TextField, colors, font, formatDateTime, radius, spacing } from '@fonzkart/ui';
import { CityChecklist } from '../src/CityChecklist';
import { PincodeEditor } from '../src/PincodeEditor';

type Pick = { partner: PartnerOverviewItem; field: 'manager' | 'rm' } | null;
type Mode = 'list' | 'create' | 'upgrade';
/** Whose cities the checklist is editing: a partner, or the new-partner form. */
type CitiesFor = { partner: PartnerOverviewItem } | { partner: null } | null;

/** Every city of a partner, main city first (older servers send only the main city). */
const citiesOf = (p: PartnerOverviewItem): City[] => (p.cities?.length ? p.cities : p.city ? [p.city] : []);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function Partners() {
  const client = useQueryClient();
  const { session } = useSession();
  const data = usePartnersOverview();
  const [mode, setMode] = useState<Mode>('list');
  const [pick, setPick] = useState<Pick>(null);
  const [citiesFor, setCitiesFor] = useState<CitiesFor>(null);
  const [pincodesFor, setPincodesFor] = useState<PartnerOverviewItem | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', cityIds: [] as string[] });
  const [tried, setTried] = useState(false);
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
    return q ? all.filter(p => [p.name, p.email, p.phone, ...citiesOf(p).map(c => c.name), p.manager?.name, p.relationshipManager?.name, ...p.pincodes]
      .some(v => v?.toLowerCase().includes(q))) : all;
  }, [data.data, query]);

  if (data.isPending) return <Loading />;
  if (data.isError) return <ErrorState message="Could not load partners." onRetry={() => data.refetch()} />;
  const { partners, zonalHeads, availableCities, relationshipManagers } = data.data;
  const role = session.status === 'signedIn' ? session.user.role : '';
  const formErrors = {
    name: nameProblem(form.name, { what: 'the business or owner name' }),
    email: emailProblem(form.email),
    phone: phoneProblem(form.phone, { required: false }),
    password: passwordProblem(form.password),
    cities: role === 'ZONAL_HEAD' && !form.cityIds.length ? 'Choose at least one of your cities.' : null,
  };

  /** Runs one change and says how it went; true when it worked. */
  const run = async (task: () => Promise<ActionResult | void>, done: string | ((result: ActionResult | void) => string)) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await task();
      if (result && result.error) {
        setMessage({ tone: 'error', text: result.error });
        return false;
      }
      setMessage({ tone: 'success', text: typeof done === 'function' ? done(result) : done });
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

  const assign = (p: PartnerOverviewItem, change: { managerId?: string | null; relationshipManagerId?: string | null }) =>
    run(() => adminApi.updatePartnerAssignment(p.id, {
      cityId: p.cityId ?? 'none',
      managerId: 'managerId' in change ? change.managerId ?? 'none' : p.managerId ?? 'none',
      relationshipManagerId: 'relationshipManagerId' in change ? change.relationshipManagerId ?? 'none' : p.relationshipManagerId ?? 'none',
    }), `${p.name} updated.`);

  const saveCities = (p: PartnerOverviewItem, cityIds: string[], mainCityId?: string) => run(
    () => adminApi.updatePartnerCities(p.id, cityIds, mainCityId),
    result => {
      const names = cityIds.map(id => availableCities.find(c => c.id === id)?.name ?? citiesOf(p).find(c => c.id === id)?.name).filter(Boolean);
      const removed = (result as { removedPincodes?: number } | undefined)?.removedPincodes ?? 0;
      return `${p.name} now serves ${names.length ? names.join(', ') : 'no city'}.`
        + (removed ? ` ${plural(removed, 'pincode')} of the removed cities left their service areas.` : '');
    },
  );

  const createPartner = () => {
    setTried(true);
    if (Object.values(formErrors).some(Boolean)) return;
    void run(() => adminApi.createPartner({
      name: form.name.trim(), email: form.email.trim(), phone: form.phone ? `+91${form.phone}` : '', password: form.password,
      cityId: form.cityIds[0], cityIds: form.cityIds,
    }), `${form.name.trim()} registered as a partner.`).then(ok => {
      if (!ok) return;
      setForm({ name: '', email: '', phone: '', password: '', cityIds: [] });
      setTried(false);
      setMode('list');
    });
  };
  const cityNames = (ids: string[]) => ids.map(id => availableCities.find(c => c.id === id)?.name).filter(Boolean).join(', ');

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
          <TextField label="Business or owner name" value={form.name} onChangeText={name => setForm(f => ({ ...f, name }))}
            error={formErrors.name} showError={tried} />
          <TextField label="Email" value={form.email} onChangeText={email => setForm(f => ({ ...f, email: email.trim() }))} autoCapitalize="none"
            keyboardType="email-address" error={formErrors.email} showError={tried} />
          <TextField label="Phone (optional)" value={form.phone} onChangeText={phone => setForm(f => ({ ...f, phone: cleanPhone(phone) }))}
            keyboardType="phone-pad" prefix="+91" placeholder="10-digit mobile number" error={formErrors.phone} showError={tried} />
          <TextField label="First password" value={form.password} onChangeText={password => setForm(f => ({ ...f, password }))} secureTextEntry
            error={formErrors.password} showError={tried}
            hint="At least 6 characters. Share it with the partner privately; they can change it with Forgot password." />
          <Text style={styles.subhead}>Cities</Text>
          <Pressable onPress={() => setCitiesFor({ partner: null })} accessibilityRole="button" style={styles.picker}>
            <Text style={form.cityIds.length ? styles.pickerValue : styles.pickerEmpty} numberOfLines={2}>
              {form.cityIds.length ? `★ ${cityNames(form.cityIds)}` : 'Choose the cities this partner serves'}
            </Text>
            <Text style={styles.change}>{form.cityIds.length ? 'Change' : 'Choose'}</Text>
          </Pressable>
          {tried && formErrors.cities ? <Text style={styles.error}>⚠ {formErrors.cities}</Text> : null}
          <Button title="Register partner" loading={busy} onPress={createPartner} />
        </Card>
      ) : null}
      {mode === 'upgrade' ? <UpgradeForm busy={busy} onSubmit={(email, cityId) => void run(() => adminApi.grantPartner(email, cityId), `${email} is now a partner.`)}
        cities={availableCities} /> : null}
    </View>
  );

  // The partner being edited in the city checklist, and the cities this person may not change for them.
  const checklistPartner = citiesFor?.partner ?? null;
  const lockedCities = checklistPartner ? citiesOf(checklistPartner).filter(c => !availableCities.some(a => a.id === c.id)) : [];

  return (
    <>
      <FlatList
        data={mode === 'list' ? shown : []}
        // Redraw the cards when one opens or closes, or the executives arrive (they are not part of `data`).
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
          const cities = citiesOf(p);
          const missing = [!cities.length && 'a city', !p.pincodes.length && 'service areas'].filter(Boolean).join(' and ');
          const cityLine = cities.length ? `${cities[0]!.name}${cities.length > 1 ? ` +${cities.length - 1} more` : ''}` : 'No city';
          return (
            <View style={[styles.partner, expanded && styles.partnerOpen]}>
              <Pressable onPress={() => toggle(p.id)} style={styles.summary} accessibilityRole="button"
                accessibilityState={{ expanded }} accessibilityLabel={`${p.name}. ${expanded ? 'Tap to close' : 'Tap for details'}`}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{p.name.trim().charAt(0).toUpperCase() || '?'}</Text></View>
                <View style={styles.flex}>
                  <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {cityLine} · {plural(p.pincodes.length, 'pincode')} · {plural(executives.length, 'executive')}
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

                  <Text style={styles.section}>Responsibility</Text>
                  <View style={styles.block}>
                    <Duty label={`Cities (${cities.length})`} action={cities.length ? 'Edit' : 'Add'} onPress={() => setCitiesFor({ partner: p })}>
                      {cities.length ? (
                        <View style={styles.chips}>
                          {cities.map((c, i) => (
                            <Text key={c.id} style={[styles.chip, i === 0 && styles.chipMain]}>
                              {i === 0 ? '★ ' : ''}{c.name}{c.isActive === false ? ' (paused)' : ''}
                            </Text>
                          ))}
                        </View>
                      ) : <Text style={styles.warnText}>No city yet: choose the cities this partner serves.</Text>}
                    </Duty>
                    <Duty label="Zonal head" action="Change" hidden={role === 'ZONAL_HEAD'} onPress={() => setPick({ partner: p, field: 'manager' })}>
                      <Text style={styles.value}>{p.manager?.name ?? 'None'}</Text>
                    </Duty>
                    <Duty label="Relationship manager" action="Change" hidden={role === 'RELATIONSHIP_MANAGER'} onPress={() => setPick({ partner: p, field: 'rm' })}>
                      <Text style={styles.value}>{p.relationshipManager?.name ?? 'None'}</Text>
                    </Duty>
                    <Duty label={`Service areas (${p.pincodes.length})`} action="Edit" onPress={() => setPincodesFor(p)} last>
                      {p.pincodes.length ? (
                        <View style={styles.chips}>
                          {p.pincodes.slice(0, 24).map(code => <Text key={code} style={styles.chip}>{code}</Text>)}
                          {p.pincodes.length > 24 ? <Text style={styles.more}>+{p.pincodes.length - 24} more</Text> : null}
                        </View>
                      ) : <Text style={styles.warnText}>None yet: this partner gets no new orders until pincodes are added.</Text>}
                    </Duty>
                  </View>

                  <Text style={styles.section}>Field executives ({executives.length})</Text>
                  {executives.length ? executives.map(r => {
                    const active = r.orders.filter(o => !/completed|cancel|fail|reject/i.test(o.status)).length;
                    return (
                      <Text key={r.id} style={styles.muted}>
                        {r.name} · {displayPhone(r.phone)} · {r.status.toLowerCase()}{active ? ` · ${plural(active, 'active order')}` : ''}
                      </Text>
                    );
                  }) : <Text style={styles.muted}>{riders.isPending ? 'Loading…' : 'None yet. Add them under Field executives.'}</Text>}
                </View>
              ) : null}
            </View>
          );
        }}
      />
      <ListPicker
        visible={pick !== null}
        title={pick?.field === 'manager' ? 'Zonal head' : 'Relationship manager'}
        items={[{ id: 'none', name: 'None' }, ...(pick?.field === 'manager' ? zonalHeads : relationshipManagers)]}
        keyOf={x => x.id}
        labelOf={x => x.name}
        onClose={() => setPick(null)}
        onPick={x => {
          const current = pick;
          setPick(null);
          const value = x.id === 'none' ? null : x.id;
          if (!current) return;
          if (current.field === 'manager') void assign(current.partner, { managerId: value });
          else void assign(current.partner, { relationshipManagerId: value });
        }}
      />
      <CityChecklist
        visible={citiesFor !== null}
        title={checklistPartner ? `Cities of ${checklistPartner.name}` : 'Cities of the new partner'}
        cities={availableCities}
        locked={lockedCities}
        initial={checklistPartner ? citiesOf(checklistPartner).map(c => c.id) : form.cityIds}
        initialMain={checklistPartner ? checklistPartner.cityId : form.cityIds[0]}
        saveLabel={checklistPartner ? 'Save cities' : 'Use these cities'}
        onClose={() => setCitiesFor(null)}
        onSave={(cityIds, mainCityId) => {
          const p = checklistPartner;
          setCitiesFor(null);
          if (p) void saveCities(p, cityIds, mainCityId);
          else setForm(f => ({ ...f, cityIds }));
        }}
      />
      <PincodeEditor
        visible={pincodesFor !== null}
        title={`Service areas of ${pincodesFor?.name ?? ''}`}
        note={pincodesFor && citiesOf(pincodesFor).length
          ? `New orders in these pincodes go to this partner. Only pincodes of ${citiesOf(pincodesFor).map(c => c.name).join(', ')} can be added.`
          : 'New orders in these pincodes go to this partner. Give the partner a city to use Add all.'}
        initial={pincodesFor?.pincodes ?? []}
        master={pincodesFor && citiesOf(pincodesFor).length ? [...new Set(citiesOf(pincodesFor).flatMap(c => c.pincodes ?? []))] : undefined}
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

/** One responsibility of a partner: its label, what it is now, and the button to change it. */
function Duty({ label, action, onPress, hidden, last, children }: {
  label: string;
  action: string;
  onPress: () => void;
  hidden?: boolean;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.duty, !last && styles.dutyLine]}>
      <View style={styles.dutyHead}>
        <Text style={styles.dutyLabel}>{label}</Text>
        {hidden ? null : (
          <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${action} ${label}`} style={styles.dutyButton}>
            <Text style={styles.change}>{action}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

function UpgradeForm({ busy, cities, onSubmit }: { busy: boolean; cities: { id: string; name: string }[]; onSubmit: (email: string, cityId?: string) => void }) {
  const [email, setEmail] = useState('');
  const [cityId, setCityId] = useState<string | undefined>();
  const [picking, setPicking] = useState(false);
  const [tried, setTried] = useState(false);
  const problem = emailProblem(email);
  return (
    <Card title="Make an existing account a partner">
      <Text style={styles.muted}>The person signs up on the website or in the app first; then enter their email here.</Text>
      <TextField label="Account email" value={email} onChangeText={t => setEmail(t.trim())} autoCapitalize="none" keyboardType="email-address"
        error={problem} showError={tried} />
      <Button title={cityId ? `City: ${cities.find(c => c.id === cityId)?.name}` : 'Choose city (optional)'} variant="secondary" onPress={() => setPicking(true)} />
      <Button title="Make partner" loading={busy} onPress={() => { setTried(true); if (!problem) onSubmit(email.trim(), cityId); }} />
      <ListPicker visible={picking} title="City" items={cities} keyOf={c => c.id} labelOf={c => c.name} onClose={() => setPicking(false)}
        onPick={c => { setCityId(c.id); setPicking(false); }} />
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, maxWidth: 900, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.md, marginBottom: spacing.xs },
  muted: { fontSize: font.small, color: colors.muted },
  flex: { flex: 1 },
  partner: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  partnerOpen: { borderColor: colors.green },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: font.body, fontWeight: '800', color: colors.green },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text },
  warn: { fontSize: font.tiny, fontWeight: '700', color: colors.warning.text, marginTop: 2 },
  warnText: { fontSize: font.small, color: colors.warning.text },
  chevron: { fontSize: 26, color: colors.muted, transform: [{ rotate: '90deg' }] },
  chevronOpen: { transform: [{ rotate: '-90deg' }], color: colors.green },
  details: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  section: { fontSize: font.small, fontWeight: '800', color: colors.text, marginTop: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  subhead: { fontSize: font.small, fontWeight: '600', color: colors.textSoft },
  block: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background },
  duty: { padding: spacing.md, gap: 6 },
  dutyLine: { borderBottomWidth: 1, borderBottomColor: colors.border },
  dutyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  dutyLabel: { fontSize: font.small, fontWeight: '700', color: colors.muted },
  dutyButton: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.green, paddingHorizontal: 14, paddingVertical: 4 },
  change: { fontSize: font.small, fontWeight: '800', color: colors.green },
  value: { fontSize: font.body, fontWeight: '600', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    fontSize: font.small, fontWeight: '700', color: colors.text, backgroundColor: colors.greenTint, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden',
  },
  chipMain: { backgroundColor: colors.green, color: colors.white },
  more: { fontSize: font.small, fontWeight: '700', color: colors.muted, paddingVertical: 3 },
  picker: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, minHeight: 50, paddingVertical: spacing.sm,
  },
  pickerValue: { flex: 1, fontSize: font.body, fontWeight: '600', color: colors.text },
  pickerEmpty: { flex: 1, fontSize: font.body, color: colors.muted },
  error: { fontSize: font.small, fontWeight: '600', color: colors.danger },
});
