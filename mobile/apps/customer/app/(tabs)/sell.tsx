// Sell: everything for selling a device in one tab. Search, "Sell this phone", the animated category cards, and the
// Fonzkart promise. The drawings pause while another tab or screen covers this one.
import { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import { SELL_CATEGORIES } from '@fonzkart/core';
import { makeStyles } from '@fonzkart/ui';
import { CategoryCard } from '../../src/categoryArt/CategoryCard';
import { ArtActivity, MotionActivity } from '../../src/categoryArt/motion';
import { Appear, MAX_CONTENT, SearchBar, SectionHeader, TabTitle, useTabBarSpace } from '../../src/design';
import { GRID_GAP, PAGE_PADDING, useTileWidth } from '../../src/grid';
import { ResumeCard } from '../../src/home/ResumeCard';
import { PromiseCard } from '../../src/home/sections';
import { SellThisDevice } from '../../src/home/SellThisDevice';

const SUGGESTIONS = ['iPhone 13', 'Galaxy S23', 'MacBook Air', 'iPad Air', 'Apple Watch'];

export default function Sell() {
  const styles = useStyles();
  const router = useRouter();
  const bottom = useTabBarSpace();
  const width = useTileWidth(3);
  const active = useSharedValue(true);
  useFocusEffect(useCallback(() => {
    active.value = true;
    return () => { active.value = false; };
  }, [active]));

  return (
    <View style={styles.screen}>
      <TabTitle title="Sell" subtitle="Get an instant price for your old device" />
      <ArtActivity.Provider value={active}>
      <MotionActivity.Provider value={active}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.body, { paddingBottom: bottom }]}>
        <SearchBar placeholder="Search your device" suggestions={SUGGESTIONS} onPress={() => router.push('/search')} />
        <ResumeCard />
        <Appear index={0}>
          <SellThisDevice />
        </Appear>
        <Appear index={1} style={styles.block}>
          <SectionHeader title="Choose a category" subtitle="Tap one to see your price" />
          <View style={styles.grid}>
            {SELL_CATEGORIES.map((category, index) => (
              <CategoryCard key={category.id} id={category.id} name={category.name} width={width} index={index}
                onPress={() => router.push({ pathname: '/category/[id]', params: { id: category.id } })} />
            ))}
          </View>
        </Appear>
        <Appear index={2}>
          <PromiseCard />
        </Appear>
      </ScrollView>
      </MotionActivity.Provider>
      </ArtActivity.Provider>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { paddingHorizontal: PAGE_PADDING, paddingTop: 4, gap: 20, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' },
  block: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
}));
