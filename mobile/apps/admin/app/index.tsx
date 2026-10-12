import { SafeAreaView } from 'react-native-safe-area-context';
import { useServerHealth } from '@fonzkart/api';
import { AppShell, colors } from '@fonzkart/ui';

export default function Home() {
  const health = useServerHealth();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <AppShell
        appName="Fonzkart Admin"
        serverOnline={health.isPending ? undefined : health.data?.status === 'UP'}
        comingNext={[
          'Staff sign-in by role',
          'Orders dashboard and order actions',
          'Partners, riders, cities and pricing rules',
          'Catalog, banner prices and homepage control',
        ]}
      />
    </SafeAreaView>
  );
}
