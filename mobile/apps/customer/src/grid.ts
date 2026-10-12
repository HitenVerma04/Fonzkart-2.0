import { useWindowDimensions } from 'react-native';
import { spacing } from '@fonzkart/ui';

export const PAGE_PADDING = spacing.lg;
export const GRID_GAP = spacing.md;

/** Width of one tile when `columns` tiles share a row of the screen. */
export function useTileWidth(columns: number) {
  const { width } = useWindowDimensions();
  const content = Math.min(width, 640) - PAGE_PADDING * 2;
  return Math.floor((content - GRID_GAP * (columns - 1)) / columns);
}
