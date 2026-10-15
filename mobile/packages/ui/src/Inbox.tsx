// A notification list (customer inbox, executive inbox, staff bell) with unread markers and "mark all as read".
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { formatDateTime } from './Orders';
import { EmptyState } from './StateView';
import { colors, font, radius, spacing } from './theme';

export interface InboxItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  orderId: string | null;
}

export function InboxList({ items, refreshing, onRefresh, onOpen, onMarkAll, emptyText = 'No notifications yet.' }: {
  items: InboxItem[];
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (item: InboxItem) => void;
  onMarkAll: () => void;
  emptyText?: string;
}) {
  const unread = items.filter(n => !n.isRead).length;
  return (
    <FlatList
      data={items}
      keyExtractor={n => n.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={unread ? <Button title={`Mark all ${unread} as read`} variant="link" onPress={onMarkAll} /> : null}
      ListEmptyComponent={<EmptyState message={emptyText} />}
      renderItem={({ item }) => (
        <Pressable onPress={() => onOpen(item)} accessibilityRole="button"
          style={({ pressed }) => [styles.item, !item.isRead && styles.unread, pressed && styles.pressed]}>
          <View style={styles.top}>
            <Text style={styles.title}>{item.title}</Text>
            {!item.isRead ? <View style={styles.dot} accessibilityLabel="Unread" /> : null}
          </View>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, maxWidth: 720, width: '100%', alignSelf: 'center', flexGrow: 1 },
  item: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4 },
  unread: { borderColor: '#bbf7d0', backgroundColor: colors.greenSoft },
  pressed: { opacity: 0.7 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: font.body, fontWeight: '700', color: colors.text, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  message: { fontSize: font.small, color: colors.textSoft },
  date: { fontSize: font.tiny, color: colors.muted },
});
