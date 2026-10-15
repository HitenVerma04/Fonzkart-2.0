// The Fonzkart mailboxes the signed-in staff member may use (the website's Email System): pick a mailbox, read its
// messages, write a new one.
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useEmailMessages } from '@fonzkart/api';
import { Button, EmptyState, ErrorState, ListPicker, Loading, colors, font, formatDateTime, radius, spacing } from '@fonzkart/ui';

export default function Email() {
  const router = useRouter();
  const [account, setAccount] = useState<string | undefined>();
  const [picking, setPicking] = useState(false);
  const list = useEmailMessages(account);

  if (list.isPending) return <Loading label="Loading mail…" />;
  if (list.isError) return <ErrorState message={list.error.message} onRetry={() => list.refetch()} />;
  const mailboxes = list.data.reachableEmails;

  return (
    <>
      <FlatList
        data={list.data.emails}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
        ListHeaderComponent={
          <View style={styles.head}>
            <Button title={account ? `Mailbox: ${account}` : 'All my mailboxes'} variant="secondary" onPress={() => setPicking(true)} />
            <Button title="Write an email" onPress={() => router.push({ pathname: '/email/compose', params: { from: account ?? mailboxes[0] ?? '' } })} />
          </View>
        }
        ListEmptyComponent={<EmptyState message="No messages." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/email/[id]', params: { id: item.id } })} accessibilityRole="button"
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <View style={styles.top}>
              <Text style={styles.who} numberOfLines={1}>{item.isOutbound ? `To ${item.toEmail}` : item.fromEmail}</Text>
              <Text style={styles.date}>{formatDateTime(item.date)}</Text>
            </View>
            <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
            <Text style={styles.snippet} numberOfLines={2}>{item.snippet || item.text}</Text>
          </Pressable>
        )}
      />
      <ListPicker visible={picking} title="Mailbox" items={['', ...mailboxes]} keyOf={m => m || 'all'}
        labelOf={m => m || 'All my mailboxes'} onClose={() => setPicking(false)}
        onPick={m => { setAccount(m || undefined); setPicking(false); }} />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, maxWidth: 900, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.sm, marginBottom: spacing.xs },
  item: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 2 },
  pressed: { borderColor: colors.green },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  who: { flex: 1, fontSize: font.small, fontWeight: '700', color: colors.textSoft },
  date: { fontSize: font.tiny, color: colors.muted },
  subject: { fontSize: font.body, fontWeight: '700', color: colors.text },
  snippet: { fontSize: font.small, color: colors.muted },
});
