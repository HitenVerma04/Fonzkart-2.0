// The relationship manager's dashboard (the website's RM Dashboard): their partners, each partner's executives and
// open orders, and the orders that are running late.
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useRmDashboard } from '@fonzkart/api';
import { displayPhone } from '@fonzkart/core';
import { Card, EmptyState, ErrorState, Loading, Notice, OrderCard, colors, font, spacing } from '@fonzkart/ui';

export default function RmDashboard() {
  const router = useRouter();
  const data = useRmDashboard();
  if (data.isPending) return <Loading />;
  if (data.isError) return <ErrorState message="The RM dashboard is for relationship managers." onRetry={() => data.refetch()} />;
  const { partners, totalDelayed } = data.data;
  return (
    <ScrollView contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={data.isRefetching} onRefresh={() => void data.refetch()} />}>
      {totalDelayed ? <Notice tone="error" text={`${totalDelayed} order${totalDelayed === 1 ? ' is' : 's are'} running late.`} />
        : <Notice tone="success" text="No delayed orders." />}
      {!partners.length ? <EmptyState message="No partners are assigned to you yet." /> : null}
      {partners.map(p => (
        <Card key={p.id} title={p.name}>
          <Text style={styles.muted}>{[p.city?.name, p.phone ? displayPhone(p.phone) : null, p.email].filter(Boolean).join(' · ')}</Text>
          <Text style={styles.muted}>
            Executives: {p.riders.map(r => r.name).join(', ') || 'none'} · Open: {p.unassignedOrders.length} waiting, {p.assignedOrders.length} assigned
          </Text>
          {p.delayedOrders.length ? <Text style={styles.late}>Running late</Text> : null}
          <View style={styles.orders}>
            {p.delayedOrders.map(o => (
              <OrderCard key={o.id} orderNumber={o.orderNumber} device={o.device} price={o.price} status={o.status} date={o.date} audience="staff"
                onPress={() => router.push({ pathname: '/orders/[id]', params: { id: o.id } })} />
            ))}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 900, width: '100%', alignSelf: 'center' },
  muted: { fontSize: font.small, color: colors.muted },
  late: { fontSize: font.small, fontWeight: '800', color: colors.danger, marginTop: spacing.xs },
  orders: { gap: spacing.sm },
});
