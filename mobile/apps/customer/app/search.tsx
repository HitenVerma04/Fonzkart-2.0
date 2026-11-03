import { useEffect, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MIN_SEARCH_LENGTH, useBrands, useModelSearch } from '@fonzkart/api';
import { makeStyles } from '@fonzkart/ui';
import { modelImage } from '@fonzkart/core';
import {
  EmptyState, ErrorState, ListItem, MAX_CONTENT, PAGE_PADDING, ProductImage, deviceKindOf, SearchBar, SkeletonRows, SkeletonScreen,
} from '../src/design';

const DEBOUNCE_MS = 300;

export default function Search() {
  const styles = useStyles();
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
      <SearchBar value={text} onChangeText={setText} placeholder="Search your phone, e.g. iPhone 14" autoFocus />
      {tooShort ? (
        <EmptyState icon="search" title="Find your device" message="Type at least 2 letters of your device's name." />
      ) : results.isPending ? (
        <SkeletonScreen label="Searching">
          <SkeletonRows count={6} image={52} kind="phone" />
        </SkeletonScreen>
      ) : results.isError ? (
        <ErrorState error={results.error} onRetry={() => results.refetch()} />
      ) : (
        <FlatList
          data={results.data}
          keyExtractor={m => m.id}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon="search" title="No device found" message="Try a shorter name." />}
          renderItem={({ item }) => (
            <ListItem
              leading={<ProductImage uri={modelImage(item.img, item.category)} label={item.name} size={52} kind={deviceKindOf(item.category)} />}
              title={item.name}
              subtitle={brandNames.get(item.brandId) ?? item.brandId}
              onPress={() => router.push({ pathname: '/model/[id]', params: { id: item.id, name: item.name, img: modelImage(item.img, item.category) ?? '', category: item.category } })}
            />
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  page: { flex: 1, padding: PAGE_PADDING, paddingTop: 4, gap: 14, maxWidth: MAX_CONTENT, width: '100%', alignSelf: 'center', backgroundColor: colors.background },
  list: { gap: 10, paddingBottom: 32 },
}));
