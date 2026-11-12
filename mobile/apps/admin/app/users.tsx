// Users & roles (the website's Users page, admins only): everyone with a staff role, and granting or removing the
// admin, zonal head and relationship manager roles. The person must have an account first (signed up on the website
// or in the Fonzkart app). Removing a role can be undone for a short while: Undo gives the same role back (removing a
// role changes only the role, so a partner keeps its city, pincodes and managers).
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { adminApi, useStaffDirectory, type ActionResult, type StaffUser } from '@fonzkart/api';
import { displayPhone } from '@fonzkart/core';
import { Button, Card, ErrorState, Loading, Notice, Segmented, TextField, colors, font, radius, spacing } from '@fonzkart/ui';

type Grant = 'admin' | 'zonal' | 'rm';
type Removed = { user: StaffUser; role: string; restore: () => Promise<ActionResult> };
const UNDO_SECONDS = 15;

export default function Users() {
  const client = useQueryClient();
  const directory = useStaffDirectory();
  const [grant, setGrant] = useState<Grant>('rm');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [removed, setRemoved] = useState<Removed | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // The undo bar goes away on its own after a while.
  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), UNDO_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [removed]);

  if (directory.isPending) return <Loading />;
  if (directory.isError) return <ErrorState message="Could not load users." onRetry={() => directory.refetch()} />;

  /** Runs one change; true when it worked. */
  const run = async (task: () => Promise<ActionResult>, done: string | null) => {
    setMessage(null);
    try {
      const r = await task();
      if (r.error) {
        setMessage({ tone: 'error', text: r.error });
        return false;
      }
      if (done !== null) setMessage({ tone: 'success', text: r.message ?? done });
      await client.invalidateQueries({ queryKey: ['staff'] });
      return true;
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Something went wrong.' });
      return false;
    }
  };

  const removeRole = async (u: StaffUser, role: string, remove: (email: string) => Promise<ActionResult>, restore: () => Promise<ActionResult>) => {
    setBusyId(u.id);
    setRemoved(null);
    const ok = await run(() => remove(u.email), null);
    setBusyId(null);
    if (ok) setRemoved({ user: u, role, restore });
  };

  const undo = async () => {
    const r = removed;
    if (!r) return;
    setRemoved(null);
    await run(r.restore, `${r.user.name} is a ${r.role.toLowerCase()} again.`);
  };

  const give = () => {
    const target = email.trim();
    const task = grant === 'admin' ? adminApi.addAdmin : grant === 'zonal' ? adminApi.grantZonalHead : adminApi.grantRelationshipManager;
    void run(() => task(target), `${target} updated.`).then(ok => { if (ok) setEmail(''); });
  };

  const d = directory.data;
  /** `role` names the role in messages; `restore` gives it back (Undo). */
  const group = (title: string, role: string, users: StaffUser[], restore?: (u: StaffUser) => Promise<ActionResult>, remove = adminApi.removeRole) => (
    <Card title={`${title} (${users.length})`}>
      {users.length ? users.map(u => (
        <View key={u.id} style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.name}>{u.name}</Text>
            <Text style={styles.muted}>{[u.email, u.phone ? displayPhone(u.phone) : null].filter(Boolean).join(' · ')}</Text>
          </View>
          {restore ? <Button title="Remove role" variant="link" loading={busyId === u.id} disabled={busyId !== null}
            onPress={() => void removeRole(u, role, remove, () => restore(u))} /> : null}
        </View>
      )) : <Text style={styles.muted}>None</Text>}
    </Card>
  );

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Card title="Give a role">
        <Segmented<Grant> value={grant} onChange={setGrant} options={[
          { id: 'rm', label: 'Relationship manager' }, { id: 'zonal', label: 'Zonal head' }, { id: 'admin', label: 'Admin' },
        ]} />
        <TextField label="Account email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Button title="Give role" disabled={!email.trim()} onPress={give} />
      </Card>
      {removed ? (
        <View style={styles.undoBar} accessibilityLiveRegion="polite">
          <Text style={styles.undoText}>{removed.user.name} is no longer a {removed.role.toLowerCase()} (now a customer account).</Text>
          <Pressable onPress={() => void undo()} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Undo: make ${removed.user.name} a ${removed.role.toLowerCase()} again`}>
            <Text style={styles.undoButton}>UNDO</Text>
          </Pressable>
        </View>
      ) : null}
      {message ? <Notice tone={message.tone} text={message.text} /> : null}
      {group('Super admins', 'Super admin', d.superAdmins)}
      {group('Admins', 'Admin', d.admins, u => adminApi.addAdmin(u.email), adminApi.removeAdmin)}
      {group('Zonal heads', 'Zonal head', d.zonalHeads, u => adminApi.grantZonalHead(u.email))}
      {group('Relationship managers', 'Relationship manager', d.relationshipManagers, u => adminApi.grantRelationshipManager(u.email))}
      {group('Partners', 'Partner', d.partners, u => adminApi.grantPartner(u.email, u.cityId ?? undefined, u.managerId ?? undefined))}
      <Card title={`Field executives (${d.riders.length + d.fieldExecutiveUsers.length})`}>
        {[...d.riders, ...d.fieldExecutiveUsers].map(r => (
          <Text key={r.id} style={styles.muted}>{r.name}{r.phone ? ` · ${displayPhone(r.phone)}` : ''}</Text>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 900, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text },
  muted: { fontSize: font.small, color: colors.muted },
  undoBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.navy, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  undoText: { flex: 1, fontSize: font.small, color: colors.white },
  undoButton: { fontSize: font.small, fontWeight: '800', color: '#4ade80', letterSpacing: 0.6 },
});
