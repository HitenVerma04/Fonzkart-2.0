// Pincode requests: partners asking (in the Partner app) to serve more pincodes. Admins, and zonal heads for the
// partners in their cities, approve all or some of the pincodes (tap a pincode to leave it out) or reject the request
// with a reason. Approving adds the pincodes to the partner, and to its city's list when missing; the partner gets a
// notification either way.
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { pincodeRequestsApi, pincodeRequestsError, staffKeys, usePincodeRequests, type PincodeRequestForReview } from '@fonzkart/api';
import { displayPhone } from '@fonzkart/core';
import { Button, EmptyState, ErrorState, Loading, Notice, Segmented, TextPrompt, colors, font, formatDateTime, radius, spacing } from '@fonzkart/ui';

type Tab = 'pending' | 'decided';
const STATUS_LABEL: Record<string, string> = { APPROVED: 'Approved', REJECTED: 'Rejected', CANCELLED: 'Cancelled by partner', PENDING: 'Waiting' };

export default function PincodeRequests() {
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>('pending');
  const pending = usePincodeRequests('pending');
  const decided = usePincodeRequests('decided', tab === 'decided');
  const list = tab === 'pending' ? pending : decided;
  // Pincodes left out of an approval, per request (everything is approved unless tapped off).
  const [leftOut, setLeftOut] = useState<Record<string, string[]>>({});
  const [rejecting, setRejecting] = useState<PincodeRequestForReview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['staff', 'pincode-requests'] });
    await client.invalidateQueries({ queryKey: ['staff'] });
    void client.invalidateQueries({ queryKey: staffKeys.inbox });
  };

  const act = async (id: string, task: () => Promise<{ error?: string }>, done: string) => {
    setBusy(id);
    setMessage(null);
    try {
      const r = await task();
      if (r.error) setMessage({ tone: 'error', text: r.error });
      else {
        setMessage({ tone: 'success', text: done });
        await refresh();
      }
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Something went wrong. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  const toggle = (id: string, code: string) => setLeftOut(now => {
    const off = now[id] ?? [];
    return { ...now, [id]: off.includes(code) ? off.filter(c => c !== code) : [...off, code] };
  });

  const approve = (r: PincodeRequestForReview) => {
    const off = leftOut[r.id] ?? [];
    const chosen = r.pincodes.filter(p => !off.includes(p));
    const outside = r.city ? chosen.filter(p => !r.city!.pincodes.includes(p)).length : 0;
    void act(r.id, () => pincodeRequestsApi.approve(r.id, chosen),
      `${r.partner?.name ?? 'The partner'} now serves ${chosen.length} more pincode${chosen.length === 1 ? '' : 's'}`
      + (outside ? `; ${outside} added to ${r.city!.name}'s list too.` : '.'));
  };

  if (list.isPending) return <Loading label="Loading requests…" />;
  if (list.isError) return <ErrorState message={pincodeRequestsError(list.error)} onRetry={() => list.refetch()} />;

  return (
    <>
      <FlatList
        data={list.data}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        // The cards depend on these, which are not part of `data`.
        extraData={[leftOut, busy]}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
        ListHeaderComponent={
          <View style={styles.head}>
            <Segmented<Tab> value={tab} onChange={t => { setTab(t); setMessage(null); }} options={[
              { id: 'pending', label: 'Waiting', count: pending.data?.length },
              { id: 'decided', label: 'Decided' },
            ]} />
            {tab === 'pending' ? (
              <Text style={styles.muted}>Tap a pincode to leave it out, then approve the rest. Approved pincodes start getting this partner's new orders straight away.</Text>
            ) : null}
            {message ? <Notice tone={message.tone} text={message.text} /> : null}
          </View>
        }
        ListEmptyComponent={<EmptyState message={tab === 'pending' ? 'No requests waiting. Partners ask for pincodes from the Partner app.' : 'Nothing decided yet.'} />}
        renderItem={({ item: r }) => {
          const off = leftOut[r.id] ?? [];
          const chosen = r.pincodes.filter(p => !off.includes(p));
          const served = new Set(r.partner?.pincodes ?? []);
          const onCityList = new Set(r.city?.pincodes ?? []);
          return (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.name} numberOfLines={1}>{r.partner?.name ?? 'Partner removed'}</Text>
                <Text style={styles.muted}>{formatDateTime(r.createdAt)}</Text>
              </View>
              <Text style={styles.muted}>
                {[r.city?.name ?? 'No city', r.partner?.phone ? displayPhone(r.partner.phone) : r.partner?.email,
                  `serves ${r.partner?.pincodes.length ?? 0} now`].filter(Boolean).join(' · ')}
              </Text>
              {r.note ? <Text style={styles.note}>“{r.note}”</Text> : null}

              {r.status === 'PENDING' ? (
                <>
                  <Text style={styles.subhead}>Asks for {r.pincodes.length} · approving {chosen.length}</Text>
                  <View style={styles.chips}>
                    {r.pincodes.map(code => {
                      const on = !off.includes(code);
                      const tag = served.has(code) ? ' (has it)' : r.city && !onCityList.has(code) ? ' (new to city)' : '';
                      return (
                        <Pressable key={code} onPress={() => toggle(r.id, code)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                          accessibilityLabel={`${code}${tag}`}>
                          <Text style={[styles.chip, on ? styles.chipOn : styles.chipOff, tag.includes('new') && on && styles.chipNew]}>
                            {on ? '✓ ' : ''}{code}{tag}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {r.city && r.pincodes.some(p => !onCityList.has(p))
                    ? <Text style={styles.muted}>“New to city” pincodes are not on {r.city.name}'s list yet; approving adds them to it.</Text>
                    : null}
                  <View style={styles.actions}>
                    <View style={styles.flex}>
                      <Button title="Reject" variant="secondary" disabled={busy !== null} onPress={() => setRejecting(r)} />
                    </View>
                    <View style={styles.flex}>
                      <Button title={chosen.length === r.pincodes.length ? 'Approve all' : `Approve ${chosen.length}`} loading={busy === r.id}
                        disabled={!chosen.length || busy !== null} onPress={() => approve(r)} />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.status, r.status === 'APPROVED' ? styles.ok : styles.no]}>
                    {STATUS_LABEL[r.status] ?? r.status}{r.reviewedAt ? ` · ${formatDateTime(r.reviewedAt)}` : ''}
                  </Text>
                  <Text style={styles.codes}>Asked: {r.pincodes.join(', ')}</Text>
                  {r.status === 'APPROVED' ? <Text style={styles.codes}>Approved: {r.approved.join(', ')}</Text> : null}
                  {r.reviewNote ? <Text style={styles.muted}>Note: {r.reviewNote}</Text> : null}
                </>
              )}
            </View>
          );
        }}
      />
      <TextPrompt
        visible={rejecting !== null}
        title={`Reject ${rejecting?.partner?.name ?? ''}'s request?`}
        message="The partner sees this reason in the Partner app."
        label="Reason (optional)"
        placeholder="e.g. Another partner already covers these areas"
        confirmLabel="Reject"
        onClose={() => setRejecting(null)}
        onSubmit={reason => {
          const r = rejecting!;
          setRejecting(null);
          void act(r.id, () => pincodeRequestsApi.reject(r.id, reason), `Request from ${r.partner?.name ?? 'the partner'} rejected.`);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, maxWidth: 900, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.md, marginBottom: spacing.xs },
  flex: { flex: 1 },
  muted: { fontSize: font.small, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { flex: 1, fontSize: font.body, fontWeight: '800', color: colors.text },
  note: { fontSize: font.small, color: colors.text, fontStyle: 'italic' },
  subhead: { fontSize: font.small, fontWeight: '800', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { fontSize: font.small, fontWeight: '700', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden', borderWidth: 1 },
  chipOn: { color: colors.white, backgroundColor: colors.green, borderColor: colors.green },
  chipOff: { color: colors.muted, backgroundColor: colors.surface, borderColor: colors.border, textDecorationLine: 'line-through' },
  chipNew: { backgroundColor: '#b45309', borderColor: '#b45309' },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  status: { fontSize: font.small, fontWeight: '800' },
  ok: { color: colors.green },
  no: { color: colors.danger },
  codes: { fontSize: font.small, color: colors.text },
});
