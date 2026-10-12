import { SafeAreaView } from 'react-native-safe-area-context';
import { useServerHealth } from '@fonzkart/api';
import { AppShell, colors } from '@fonzkart/ui';

export default function Home() {
  const health = useServerHealth();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <AppShell
        appName="Fonzkart Partner"
        serverOnline={health.isPending ? undefined : health.data?.status === 'UP'}
        comingNext={[
          'Rider sign-in with phone number',
          'Assigned pickups with map and call',
          'Device re-check, photos and IMEI scan',
          'Partner dashboard, riders and payouts',
        ]}
      />
    </SafeAreaView>
  );
}
