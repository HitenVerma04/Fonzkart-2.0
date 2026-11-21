// Service areas (partner mode): the pincodes this partner serves, and requests for more. A request goes to the
// admins and the partner's zonal head, who approve all or some of the pincodes in the Admin app; approved pincodes
// are added straight away and the partner gets a notification.
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { pincodeRequestKeys, pincodeRequestsApi, pincodeRequestsError, staffKeys, useMyPincodeRequests, type MyPincodes, type PincodeRequestItem } from '@fonzkart/api';
import { Button, Card, ErrorState, Loading, Notice, colors, font, formatDateTime, radius, spacing } from '@fonzkart/ui';
import { usePartnerSession } from '../../src/session';

const STATUS: Record<PincodeRequestItem['status'], { label: string; color: string; background: string }> = {
  PENDING: { label: 'Waiting for approval', color: '#92400e', background: '#fffbeb' },
  APPROVED: { label: 'Approved', color: '#166534', background: '#dcfce7' },
  REJECTED: { label: 'Not approved', color: '#991b1b', background: '#fef2f2' },
  CANCELLED: { label: 'Cancelled', color: '#4b5563', background: '#f3f4f6' },
};
const SHOW_FIRST = 30;

/** Every city the partner serves, main city first (older servers send only the main city). */
const myCities = (data: MyPincodes | undefined) => (data?.cities?.length ? data.cities : data?.city ? [data.city] : []);

export default function ServiceAreas() {
  const client = useQueryClient();
  const { session } = usePartnerSession();
  const signedIn = session.status === 'partner';
  const data = useMyPincodeRequests(signedIn);
  const [chosen, setChosen] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [note, setNote] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAllMine, setShowAllMine] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  // City pincodes the partner could ask for: not served yet and not already waiting in a request.
  const { mine, waiting, suggestions } = useMemo(() => {
    const own = new Set(data.data?.pincodes ?? []);
    const pending = new Set((data.data?.requests ?? []).filter(r => r.status === 'PENDING').flatMap(r => r.pincodes));
    return {
      mine: own,
      waiting: pending,
      suggestions: [...new Set(myCities(data.data).flatMap(c => c.pincodes))].filter(p => !own.has(p) && !pending.has(p)),
    };
  }, [data.data]);

  if (!signedIn) return <Redirect href="/" />;
  if (data.isPending) return <Loading label="Loading your service areas…" />;
  if (data.isError) return <ErrorState message={pincodeRequestsError(data.error)} onRetry={() => data.refetch()} />;
  const { pincodes, requests } = data.data;
  const cityNames = myCities(data.data).map(c => c.name).join(', ');

  const toggle = (code: string) => setChosen(now => now.includes(code) ? now.filter(c => c !== code) : [...now, code]);

  const addTyped = () => {
    const codes = input.split(/[\s,]+/).filter(Boolean);
    if (!codes.length) return;
    const bad = codes.find(c => !/^\d{6}$/.test(c));
    if (bad) return setInputError(`"${bad}" is not a 6-digit pincode.`);
    const served = codes.find(c => mine.has(c));
    if (served) return setInputError(`You already serve ${served}.`);
    const pending = codes.find(c => waiting.has(c));
    if (pending) return setInputError(`${pending} is already waiting for approval.`);
    setInputError(null);
    setChosen(now => [...new Set([...now, ...codes])]);
    setInput('');
  };

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: pincodeRequestKeys.mine });
    await client.invalidateQueries({ queryKey: staffKeys.orders() });
  };

  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await pincodeRequestsApi.ask(chosen, note.trim());
      if (r.error) setMessage({ tone: 'error', text: r.error });
      else {
        setMessage({ tone: 'success', text: `Request sent for ${chosen.length} pincode${chosen.length === 1 ? '' : 's'}. You'll get a notification when it's decided.` });
        setChosen([]);
        setNote('');
        await refresh();
      }
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not send the request. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (r: PincodeRequestItem) => {
    if (cancelling !== r.id) return setCancelling(r.id);
    setCancelling(null);
    setMessage(null);
    try {
      const result = await pincodeRequestsApi.cancel(r.id);
      if (result.error) setMessage({ tone: 'error', text: result.error });
      else setMessage({ tone: 'success', text: 'Request cancelled.' });
      await refresh();
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not cancel. Please try again.' });
    }
  };

  const mineShown = showAllMine ? pincodes : pincodes.slice(0, SHOW_FIRST);

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={data.isRefetching} onRefresh={() => void data.refetch()} />}>
      {message ? <Notice tone={message.tone} text={message.text} /> : null}

      <Card title={`You serve ${pincodes.length} pincode${pincodes.length === 1 ? '' : 's'}`}>
        <Text style={styles.muted}>{cityNames ? `${myCities(data.data).length > 1 ? 'Cities' : 'City'}: ${cityNames}. ` : 'No city assigned yet. '}New orders in these pincodes come to you.</Text>
        {pincodes.length ? (
          <View style={styles.chips}>
            {mineShown.map(code => <Text key={code} style={[styles.chip, styles.chipMine]}>{code}</Text>)}
          </View>
        ) : <Text style={styles.muted}>None yet. Ask for the pincodes you can cover below.</Text>}
        {pincodes.length > SHOW_FIRST ? (
          <Pressable onPress={() => setShowAllMine(v => !v)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>{showAllMine ? 'Show fewer' : `Show all ${pincodes.length}`}</Text>
          </Pressable>
        ) : null}
      </Card>

      <Card title="Ask for more pincodes">
        <Text style={styles.muted}>Pick or type the pincodes you can cover. An admin approves them, usually within a day.</Text>
        <View style={styles.addRow}>
          <TextInput
            value={input}
            onChangeText={t => { setInput(t.replace(/[^\d,\s]/g, '')); setInputError(null); }}
            onSubmitEditing={addTyped}
            placeholder="Type pincodes, e.g. 560032, 560034"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            returnKeyType="done"
            style={styles.input}
          />
          <Pressable onPress={addTyped} style={styles.addButton} accessibilityRole="button">
            <Text style={styles.addText}>+ Add</Text>
          </Pressable>
        </View>
        {inputError ? <Text style={styles.error}>{inputError}</Text> : null}

        {suggestions.length ? (
          <>
            <View style={styles.rowBetween}>
              <Text style={styles.subhead}>{cityNames} pincodes you don't serve ({suggestions.length})</Text>
              <Pressable hitSlop={8} accessibilityRole="button"
                onPress={() => setChosen(now => suggestions.every(s => now.includes(s)) ? now.filter(c => !suggestions.includes(c)) : [...new Set([...now, ...suggestions])])}>
                <Text style={styles.link}>{suggestions.every(s => chosen.includes(s)) ? 'Clear' : 'Select all'}</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.suggestBox} contentContainerStyle={styles.chips} nestedScrollEnabled>
              {suggestions.map(code => {
                const on = chosen.includes(code);
                return (
                  <Pressable key={code} onPress={() => toggle(code)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                    <Text style={[styles.chip, on ? styles.chipOn : styles.chipOff]}>{on ? '✓ ' : ''}{code}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {chosen.length ? (
          <>
            <View style={styles.rowBetween}>
              <Text style={styles.subhead}>In this request ({chosen.length})</Text>
              <Pressable onPress={() => setChosen([])} hitSlop={8} accessibilityRole="button"><Text style={styles.linkDanger}>Remove all</Text></Pressable>
            </View>
            <View style={styles.chips}>
              {chosen.map(code => (
                <Pressable key={code} onPress={() => toggle(code)} accessibilityRole="button" accessibilityLabel={`Remove ${code}`}>
                  <Text style={[styles.chip, styles.chipOn]}>{code}  ×</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note for the admin (optional): areas, team size, timings"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={500}
          style={[styles.input, styles.note]}
        />
        <Button title={chosen.length ? `Send request (${chosen.length})` : 'Send request'} loading={busy} disabled={!chosen.length}
          onPress={() => void send()} />
      </Card>

      <Text style={styles.sectionTitle}>Your requests</Text>
      {requests.length ? requests.map(r => {
        const s = STATUS[r.status];
        const left = r.status === 'APPROVED' ? r.pincodes.filter(p => !r.approved.includes(p)) : [];
        return (
          <View key={r.id} style={styles.request}>
            <View style={styles.rowBetween}>
              <Text style={[styles.badge, { color: s.color, backgroundColor: s.background }]}>{s.label}</Text>
              <Text style={styles.muted}>{formatDateTime(r.createdAt)}</Text>
            </View>
            <Text style={styles.codes}>{r.pincodes.join(', ')}</Text>
            {r.note ? <Text style={styles.muted}>Your note: {r.note}</Text> : null}
            {r.status === 'APPROVED' && left.length ? <Text style={styles.muted}>Approved {r.approved.length}; not approved: {left.join(', ')}</Text> : null}
            {r.reviewNote ? <Text style={styles.muted}>Admin: {r.reviewNote}</Text> : null}
            {r.status === 'PENDING' ? (
              <Button title={cancelling === r.id ? 'Tap again to cancel the request' : 'Cancel request'} variant="link" onPress={() => void cancel(r)} />
            ) : null}
          </View>
        );
      }) : <Text style={styles.muted}>No requests yet.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 720, width: '100%', alignSelf: 'center' },
  muted: { fontSize: font.small, color: colors.muted },
  link: { fontSize: font.small, fontWeight: '700', color: colors.green },
  linkDanger: { fontSize: font.small, fontWeight: '700', color: colors.danger },
  subhead: { fontSize: font.small, fontWeight: '800', color: colors.text, flex: 1 },
  sectionTitle: { fontSize: font.heading, fontWeight: '800', color: colors.navy, marginTop: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { fontSize: font.small, fontWeight: '700', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden', borderWidth: 1 },
  chipMine: { color: colors.text, backgroundColor: colors.greenTint, borderColor: colors.greenTint },
  chipOn: { color: colors.white, backgroundColor: colors.green, borderColor: colors.green },
  chipOff: { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
  suggestBox: { maxHeight: 200 },
  addRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1, minWidth: 0, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12,
    fontSize: font.body, color: colors.text, backgroundColor: colors.background,
  },
  note: { flex: 0, minHeight: 72, paddingTop: 10, textAlignVertical: 'top' },
  addButton: { height: 44, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.green, backgroundColor: colors.greenTint, justifyContent: 'center' },
  addText: { fontSize: font.small, fontWeight: '800', color: colors.green },
  error: { fontSize: font.small, color: colors.danger },
  request: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 6 },
  badge: { fontSize: font.tiny, fontWeight: '800', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' },
  codes: { fontSize: font.body, fontWeight: '700', color: colors.text },
});
