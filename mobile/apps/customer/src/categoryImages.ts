import type { ImageSourcePropType } from 'react-native';
import type { SellCategoryId } from '@fonzkart/core';

// Copies of the website's category cards (public/category_cards/).
export const CATEGORY_IMAGES: Record<SellCategoryId, ImageSourcePropType> = {
  smartphone: require('../assets/categories/smartphones.png'),
  tablet: require('../assets/categories/tablets.png'),
  camera: require('../assets/categories/cameras.png'),
  laptop: require('../assets/categories/laptops.png'),
  watch: require('../assets/categories/smartwatches.png'),
  smarttv: require('../assets/categories/smarttvs.png'),
  console: require('../assets/categories/consoles.png'),
  desktop: require('../assets/categories/desktops.png'),
  earbuds: require('../assets/categories/earbuds.png'),
};
