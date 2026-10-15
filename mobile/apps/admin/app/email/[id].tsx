// One message (shown as text: the HTML of incoming mail is not rendered in the app).
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEmailMessage } from '@fonzkart/api';
import { Button, Card, ErrorState, InfoRow, Loading, colors, font, formatDateTime, spacing } from '@fonzkart/ui';

export default function EmailMessage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const message = useEmailMessage(id);
  if (message.isPending) return <Loading />;
  if (message.isError) return <ErrorState message="This message is not in your mailboxes." onRetry={() => message.refetch()} />;
  const m = message.data;
  const body = m.text || (m.bodyHtml ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Card title={m.subject}>
        <InfoRow label="From" value={m.fromEmail} />
        <InfoRow label="To" value={m.toEmail} />
        <InfoRow label="Date" value={formatDateTime(m.date)} />
      </Card>
      <Card>
        <Text style={styles.body} selectable>{body}</Text>
      </Card>
      {!m.isOutbound ? (
        <Button title="Reply" onPress={() => router.push({ pathname: '/email/compose', params: {
          from: m.toEmail, to: m.fromEmail, subject: m.subject.startsWith('Re:') ? m.subject : `Re: ${m.subject}` } })} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 900, width: '100%', alignSelf: 'center' },
  body: { fontSize: font.body, color: colors.text, lineHeight: 22 },
});
