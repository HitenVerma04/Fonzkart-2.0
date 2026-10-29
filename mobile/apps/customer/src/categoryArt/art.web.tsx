// The category drawings in the web build (used for design checks in a browser). Skia's web engine must be loaded
// before any module that uses Skia is imported, so each drawing is imported only after LoadSkiaWeb (WithSkiaWeb);
// an empty box of the same size holds its place meanwhile.
import type { ComponentType } from 'react';
import { View } from 'react-native';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import type { HomeTileId } from './graphics';

type ArtProps = { width: number; height: number };

const IDS: HomeTileId[] = [
  'smartphone', 'tablet', 'camera', 'laptop', 'watch', 'smarttv', 'console', 'desktop', 'earbuds', 'repair', 'screenguard', 'bulk',
];

function lazyArt(id: HomeTileId): ComponentType<ArtProps> {
  return function WebArt(props: ArtProps) {
    return (
      <WithSkiaWeb<ArtProps>
        opts={{ locateFile: (file: string) => `/${file}` }}
        getComponent={() => import('./graphics').then(m => ({ default: m.CATEGORY_ART[id] as ComponentType<ArtProps> }))}
        fallback={<View style={{ width: props.width, height: props.height }} />}
        componentProps={props}
      />
    );
  };
}

export const CATEGORY_ART = Object.fromEntries(IDS.map(id => [id, lazyArt(id)])) as Record<HomeTileId, ComponentType<ArtProps>>;
