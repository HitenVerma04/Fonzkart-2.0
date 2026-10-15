import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MIN_SEARCH_LENGTH, useBrands, useModelSearch } from '@fonzkart/api';
import { EmptyState, ErrorState, Loading, RemoteImage, SearchField, colors, font, radius, spacing } from '@fonzkart/ui';
import { PAGE_PADDING } from '../src/grid';

const DEBOUNCE_MS = 300;

export default function Search() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const results = useModelSearch(query);
  const brands = useBrands();
  const brandNames = useMemo(() => new Map((brands.data ?? []).map(b => [b.id, b.name])), [brands.data]);
  const tooShort = query.trim().length < MIN_SEARCH_LENGTH;

  return (
    <View style={styles.page}>
      <SearchField value={text} onChangeText={setText} placeholder="Search your phone, e.g. iPhone 14" autoFocus />
      {tooShort ? (
        <EmptyState message="Type at least 2 letters of your device's name." />
      ) : results.isPending ? (
        <Loading label="Searching…" />
      ) : results.isError ? (
        <ErrorState onRetry={() => results.refetch()} />
      ) : (
        <FlatList
          data={results.data}
          keyExtractor={m => m.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState message="No device found. Try a shorter name." />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/model/[id]', params: { id: item.id, name: item.name, img: item.img ?? '', category: item.category } })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <RemoteImage uri={item.img} label={item.name} size={52} />
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.brand}>{brandNames.get(item.brandId) ?? item.brandId}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: PAGE_PADDING, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  pressed: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  rowText: { flex: 1 },
  name: { fontSize: font.body, fontWeight: '600', color: colors.text },
  brand: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.muted, paddingHorizontal: spacing.sm },
});
