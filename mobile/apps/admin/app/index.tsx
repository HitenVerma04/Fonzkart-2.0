// Sign-in, then the dashboard: live order counts for the signed-in role and its sections (as the website's sidebar).
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi, useSession, useStaffInbox, useStaffOrders, useUnassignedCount } from '@fonzkart/api';
import { ORDER_STATUS, isFailed, normalizeStatus } from '@fonzkart/core';
import { Button, Loading, Logo, Notice, TextField, colors, font, radius, spacing } from '@fonzkart/ui';
import { ADMIN_APP_ROLES, sectionsFor } from '../src/menu';

const ROLE_NAMES: Record<string, string> = {
  SUPER_ADMIN: 'Super admin', ADMIN: 'Admin', ZONAL_HEAD: 'Zonal head', RELATIONSHIP_MANAGER: 'Relationship manager',
};

export default function Home() {
  const { session } = useSession();
  if (session.status === 'loading') return <Loading />;
  if (session.status === 'signedOut') return <SignIn />;
  if (!ADMIN_APP_ROLES.includes(session.user.role)) return <WrongApp role={session.user.role} />;
  return <Dashboard name={session.user.name} role={session.user.role} />;
}

function SignIn() {
  const { signIn } = useSession();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await authApi.signIn(id, password);
      if (outcome.kind === 'signedIn') await signIn(outcome.token);
      else setError(outcome.kind === 'error' ? outcome.message : 'Verify your email on the website first.');
    } catch (e) {
      setError(e instanceof Error && !/network|fetch/i.test(e.message) ? e.message : 'Could not reach Fonzkart. Check your internet connection.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.signIn} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Logo variant="stacked" height={120} />
          <Text style={styles.app}>Admin</Text>
        </View>
        <TextField label="Email or phone number" value={id} onChangeText={setId} autoCapitalize="none" autoCorrect={false}
          textContentType="username" />
        <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="password"
          onSubmitEditing={() => void submit()} />
        {error ? <Notice tone="error" text={error} /> : null}
        <Button title="Sign in" loading={busy} disabled={!id.trim() || !password} onPress={() => void submit()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function WrongApp({ role }: { role: string }) {
  const { signOut } = useSession();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Notice text={role === 'PARTNER' || role === 'FIELD_EXECUTIVE'
          ? 'Partners and field executives use the Fonzkart Partner app.'
          : 'This app is for Fonzkart staff. Customers use the Fonzkart app.'} />
        <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
      </View>
    </SafeAreaView>
  );
}

function Dashboard({ name, role }: { name: string; role: string }) {
  const router = useRouter();
  const { signOut } = useSession();
  const page = useStaffOrders(true);
  const unassigned = useUnassignedCount(true);
  const inbox = useStaffInbox(true);
  const unread = inbox.data?.filter(n => !n.isRead).length ?? 0;
  const orders = page.data?.orders ?? [];
  const count = (pred: (status: string, riderId: string | null) => boolean) =>
    orders.filter(o => pred(normalizeStatus(o.status), o.riderId)).length;
  const tiles = [
    { label: 'Waiting for executive', value: unassigned.data ?? count((s, r) => s === normalizeStatus(ORDER_STATUS.PENDING) && !r) },
    { label: 'Price approvals', value: count(s => s === ORDER_STATUS.PRICE_REVIEW) },
    { label: 'Out for pickup', value: count(s => s === ORDER_STATUS.ASSIGNED) },
    { label: 'Picked up', value: count(s => s === ORDER_STATUS.PICKED_UP) },
    { label: 'At hub', value: count(s => s === ORDER_STATUS.COMPLETED) },
    { label: 'Failed', value: count(s => isFailed(s)) },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={page.isRefetching} onRefresh={() => { void page.refetch(); void unassigned.refetch(); }} />}>
        <View style={styles.header}>
          <Logo variant="horizontal" height={40} />
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push('/inbox')} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}>Inbox{unread ? ` (${unread})` : ''}</Text>
            </Pressable>
            <Pressable onPress={() => void signOut()} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}>Sign out</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.hello}>{name}</Text>
        <Text style={styles.role}>{ROLE_NAMES[role] ?? role}</Text>

        <View style={styles.tiles}>
          {tiles.map(t => (
            <Pressable key={t.label} style={styles.tile} onPress={() => router.push('/orders')} accessibilityRole="button"
              accessibilityLabel={`${t.label}: ${t.value}`}>
              <Text style={styles.tileValue}>{page.isPending ? '…' : t.value}</Text>
              <Text style={styles.tileLabel}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sections}>
          {sectionsFor(role).map(s => (
            <Pressable key={s.href} onPress={() => router.push(s.href)} accessibilityRole="button"
              style={({ pressed }) => [styles.section, pressed && styles.pressed]}>
              <Text style={styles.sectionTitle}>{s.title}</Text>
              <Text style={styles.sectionDetail}>{s.detail}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  signIn: { padding: spacing.lg, gap: spacing.md, maxWidth: 480, width: '100%', alignSelf: 'center', paddingTop: spacing.xxl },
  brand: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  app: { fontSize: font.heading, fontWeight: '800', color: colors.navy, letterSpacing: 1, textTransform: 'uppercase' },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  page: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 900, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerActions: { flexDirection: 'row', gap: spacing.lg },
  link: { fontSize: font.small, fontWeight: '700', color: colors.green },
  hello: { fontSize: font.title, fontWeight: '800', color: colors.navy, marginTop: spacing.sm },
  role: { fontSize: font.small, color: colors.muted, marginTop: -spacing.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexGrow: 1, flexBasis: '30%', minWidth: 100, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 2 },
  tileValue: { fontSize: 26, fontWeight: '800', color: colors.navy },
  tileLabel: { fontSize: font.tiny, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  sections: { gap: spacing.sm, marginTop: spacing.sm },
  section: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: 2 },
  pressed: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  sectionTitle: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  sectionDetail: { fontSize: font.small, color: colors.muted },
});
