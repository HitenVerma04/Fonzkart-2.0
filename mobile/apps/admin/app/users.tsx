// Users & roles (the website's Users page, admins only): everyone with a staff role, and granting or removing the
// admin, zonal head and relationship manager roles. The person must have an account first (signed up on the website
// or in the Fonzkart app).
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { adminApi, useStaffDirectory, type ActionResult, type StaffUser } from '@fonzkart/api';
import { displayPhone } from '@fonzkart/core';
import { Button, Card, ErrorState, Loading, Notice, Segmented, TextField, colors, font, spacing } from '@fonzkart/ui';

type Grant = 'admin' | 'zonal' | 'rm';

export default function Users() {
  const client = useQueryClient();
  const directory = useStaffDirectory();
  const [grant, setGrant] = useState<Grant>('rm');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  if (directory.isPending) return <Loading />;
  if (directory.isError) return <ErrorState message="Could not load users." onRetry={() => directory.refetch()} />;

  const run = async (task: () => Promise<ActionResult>, done: string) => {
    setMessage(null);
    try {
      const r = await task();
      if (r.error) setMessage({ tone: 'error', text: r.error });
      else {
        setMessage({ tone: 'success', text: r.message ?? done });
        await client.invalidateQueries({ queryKey: ['staff'] });
      }
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  };

  const give = () => {
    const target = email.trim();
    const task = grant === 'admin' ? adminApi.addAdmin : grant === 'zonal' ? adminApi.grantZonalHead : adminApi.grantRelationshipManager;
    void run(() => task(target), `${target} updated.`).then(() => setEmail(''));
  };

  const d = directory.data;
  const group = (title: string, users: StaffUser[], removable: boolean, remove = adminApi.removeRole) => (
    <Card title={`${title} (${users.length})`}>
      {users.length ? users.map(u => (
        <View key={u.id} style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.name}>{u.name}</Text>
            <Text style={styles.muted}>{[u.email, u.phone ? displayPhone(u.phone) : null].filter(Boolean).join(' · ')}</Text>
          </View>
          {removable ? <Button title="Remove role" variant="link" onPress={() => void run(() => remove(u.email), `${u.name} is now a customer account.`)} /> : null}
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
      {message ? <Notice tone={message.tone} text={message.text} /> : null}
      {group('Super admins', d.superAdmins, false)}
      {group('Admins', d.admins, true, adminApi.removeAdmin)}
      {group('Zonal heads', d.zonalHeads, true)}
      {group('Relationship managers', d.relationshipManagers, true)}
      {group('Partners', d.partners, true)}
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
});
