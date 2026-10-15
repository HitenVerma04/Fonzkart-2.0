import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { accountApi, useNotifications, useProfile, useSession } from '@fonzkart/api';
import { Button, ErrorState, Loading, Logo, Notice, colors, font, radius, spacing } from '@fonzkart/ui';
import { networkMessage } from '../../src/authFlow';
import { PAGE_PADDING } from '../../src/grid';

export default function Account() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const profile = useProfile(session.status === 'signedIn');
  const inbox = useNotifications(session.status === 'signedIn');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const unread = inbox.data?.filter(n => !n.isRead).length ?? 0;

  // Store requirement: an account can be deleted in the app. It is anonymised; past orders stay for the records.
  const deleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await accountApi.deleteAccount();
      await signOut();
      router.dismissAll();
    } catch (error) {
      setDeleteError(networkMessage(error));
    } finally {
      setDeleting(false);
    }
  };
  const confirmDelete = () => {
    const message = 'Your name, email, phone and password are removed and you are signed out. Orders you placed stay in our records. This cannot be undone.';
    if (Platform.OS === 'web') {
      if ((globalThis as { confirm?: (text: string) => boolean }).confirm?.(message)) void deleteAccount();
      return;
    }
    Alert.alert('Delete your account?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: () => void deleteAccount() },
    ]);
  };

  if (session.status === 'loading') return <Loading />;

  if (session.status === 'signedOut') {
    return (
      <ScrollView contentContainerStyle={[styles.page, styles.center]}>
        <Logo variant="stacked" height={130} />
        <Text style={styles.title}>Welcome to Fonzkart</Text>
        <Text style={styles.text}>Sign in to book pickups and follow your orders. You can check prices without an account.</Text>
        <View style={styles.actions}>
          <Button title="Sign in" onPress={() => router.push('/account/sign-in')} />
          <Button title="Create account" variant="secondary" onPress={() => router.push('/account/sign-up')} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.card}>
        {profile.isPending ? (
          <Loading />
        ) : profile.isError ? (
          <ErrorState onRetry={() => profile.refetch()} />
        ) : (
          <>
            <Text style={styles.name}>{profile.data.name}</Text>
            <Row label="Email" value={profile.data.email} />
            <Row label="Phone" value={profile.data.phone ?? '—'} />
          </>
        )}
      </View>
      <Button title="My orders" onPress={() => router.push('/orders')} />
      <Button title={unread ? `Notifications (${unread} new)` : 'Notifications'} variant="secondary" onPress={() => router.push('/notifications')} />
      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
      <Button title="Delete my account" variant="link" loading={deleting} onPress={confirmDelete} />
      {deleteError ? <Notice tone="error" text={deleteError} /> : null}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: PAGE_PADDING, paddingBottom: spacing.xxl, gap: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  center: { alignItems: 'center', paddingTop: spacing.xxl },
  title: { fontSize: font.title, fontWeight: '800', color: colors.navy },
  text: { fontSize: font.body, color: colors.muted, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  name: { fontSize: font.title, fontWeight: '800', color: colors.navy },
  row: { gap: 2 },
  rowLabel: { fontSize: font.small, color: colors.muted },
  rowValue: { fontSize: font.body, fontWeight: '600', color: colors.text },
});
