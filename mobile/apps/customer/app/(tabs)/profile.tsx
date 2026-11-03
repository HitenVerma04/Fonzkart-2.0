import { useState } from 'react';
import { Alert, Linking, Platform, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { accountApi, useNotifications, useProfile, useSession } from '@fonzkart/api';
import { Logo, makeStyles, useTheme, type ThemePreference } from '@fonzkart/ui';
import { networkMessage } from '../../src/authFlow';
import { CONTACT } from '../../src/contact';
import {
  Appear, Button, Card, ErrorState, Icon, IconBadge, ListItem, Notice, Page, radii, Segmented, Skeleton, TabTitle, type,
  useDesign, useTabBarSpace,
} from '../../src/design';

export default function Account() {
  const styles = useStyles();
  const d = useDesign();
  const router = useRouter();
  const bottom = useTabBarSpace();
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
      router.navigate('/');
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

  if (session.status !== 'signedIn') {
    return (
      <View style={styles.screen}>
        <TabTitle title="Profile" />
        <Page bottom={bottom}>
          <Appear>
            <View style={[styles.welcome, { boxShadow: d.shadow.md }]}>
              <Logo variant="stacked" height={110} />
              <Text style={styles.welcomeTitle}>Welcome to Fonzkart</Text>
              <Text style={styles.welcomeText}>Sign in to book pickups and follow your orders. You can check prices without an account.</Text>
              <View style={styles.actions}>
                <Button title="Sign in" loading={session.status === 'loading'} onPress={() => router.push('/account/sign-in')} />
                <Button title="Create account" variant="secondary" onPress={() => router.push('/account/sign-up')} />
              </View>
            </View>
          </Appear>
          <Appear index={1}><AppearancePicker /></Appear>
          <Appear index={2}><HelpAndAbout /></Appear>
        </Page>
      </View>
    );
  }

  const name = profile.data?.name ?? '';
  return (
    <View style={styles.screen}>
      <TabTitle title="Profile" />
      <Page bottom={bottom}>
        <Appear>
          <View style={[styles.person, { backgroundImage: d.heroGradient, boxShadow: d.shadow.green }]}>
            {profile.isPending ? (
              <View style={styles.personLoading}>
                <Skeleton width={56} height={56} radius={28} />
                <View style={styles.personText}>
                  <Skeleton width="60%" height={18} />
                  <Skeleton width="80%" height={12} />
                </View>
              </View>
            ) : profile.isError ? (
              <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
            ) : (
              <View style={styles.personRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
                </View>
                <View style={styles.personText}>
                  <Text style={styles.name} numberOfLines={1}>{name}</Text>
                  <Text style={styles.contact} numberOfLines={1}>{profile.data.email}</Text>
                  {profile.data.phone ? <Text style={styles.contact}>{profile.data.phone}</Text> : null}
                </View>
              </View>
            )}
          </View>
        </Appear>

        <Appear index={1} style={styles.list}>
          <ListItem leading={<IconBadge name="orders" />} title="My orders" subtitle="Track pickups and payments" onPress={() => router.navigate('/orders')} />
          <ListItem
            leading={<IconBadge name="bell" />}
            title="Notifications"
            subtitle={unread ? `${unread} new update${unread === 1 ? '' : 's'}` : 'Updates about your orders'}
            highlighted={unread > 0}
            onPress={() => router.push('/notifications')}
          />
        </Appear>

        <Appear index={2}><AppearancePicker /></Appear>
        <Appear index={3}><HelpAndAbout /></Appear>

        <Appear index={3} style={styles.list}>
          <Button title="Sign out" variant="outline" icon="logout" onPress={() => void signOut()} />
          <Button title="Delete my account" variant="danger" loading={deleting} onPress={confirmDelete} />
          {deleteError ? <Notice tone="error" text={deleteError} /> : null}
        </Appear>
      </Page>
    </View>
  );
}

/** Ways to reach Fonzkart (the website's contact page), and the app version, as store apps show at the bottom. */
function HelpAndAbout() {
  const styles = useStyles();
  const open = (url: string) => void Linking.openURL(url).catch(() => undefined);
  return (
    <View style={styles.list}>
      <Text style={styles.groupTitle}>Help & support</Text>
      <ListItem leading={<IconBadge name="phone" />} title="Call us" subtitle={`${CONTACT.phoneDisplay} · ${CONTACT.hours}`} onPress={() => open(`tel:${CONTACT.phone}`)} />
      <ListItem leading={<IconBadge name="chat" />} title="Chat on WhatsApp" subtitle="Quick answers about prices and pickups" onPress={() => open(`https://wa.me/${CONTACT.whatsapp}`)} />
      <ListItem leading={<IconBadge name="mail" />} title="Email us" subtitle={CONTACT.email} onPress={() => open(`mailto:${CONTACT.email}`)} />
      <Text style={styles.version}>Fonzkart {Constants.expoConfig?.version ?? ''}</Text>
    </View>
  );
}

/** Light or dark mode: follow the phone (System), or always Light or Dark. Remembered on this phone. */
function AppearancePicker() {
  const { preference, setPreference } = useTheme();
  return (
    <Card title="Appearance" icon="sun">
      <Segmented<ThemePreference>
        value={preference}
        onChange={setPreference}
        options={[
          { id: 'system', label: 'System', icon: 'auto' },
          { id: 'light', label: 'Light', icon: 'sun' },
          { id: 'dark', label: 'Dark', icon: 'moon' },
        ]}
      />
    </Card>
  );
}

const useStyles = makeStyles(colors => ({
  screen: { flex: 1, backgroundColor: colors.background },
  welcome: { alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radii.xl, padding: 24, borderWidth: 1, borderColor: colors.border },
  welcomeTitle: { ...type.title, color: colors.navy, marginTop: 6 },
  welcomeText: { ...type.body, color: colors.muted, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: 10 },
  person: { borderRadius: radii.xl, padding: 20 },
  personLoading: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  personRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '800', color: '#ffffff' },
  personText: { flex: 1, gap: 4 },
  name: { ...type.title, fontSize: 22, color: '#ffffff' },
  contact: { ...type.small, color: 'rgba(255,255,255,0.85)' },
  list: { gap: 10 },
  groupTitle: { ...type.small, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6, marginLeft: 4 },
  version: { ...type.small, fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 10 },
}));
