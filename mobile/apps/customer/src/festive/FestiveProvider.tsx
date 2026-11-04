// Puts the festive theme chosen in the Admin app around the whole app. The launch animation covers the moment it takes
// to arrive; without a connection the app simply stays in its normal green.
import { useMemo, type ReactNode } from 'react';
import { useFestiveTheme } from '@fonzkart/api';
import { ThemeProvider, type ThemeStorage } from '@fonzkart/ui';
import { DesignContext, festiveLook } from '../design';

export function FestiveProvider({ storage, children }: { storage: ThemeStorage; children: ReactNode }) {
  const theme = useFestiveTheme();
  const look = useMemo(() => festiveLook(theme.data?.theme), [theme.data?.theme]);
  return (
    <DesignContext.Provider value={look.designs}>
      <ThemeProvider storage={storage} palettes={look.palettes}>{children}</ThemeProvider>
    </DesignContext.Provider>
  );
}
