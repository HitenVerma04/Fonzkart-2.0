// The bottom tabs: Sell (the home screen, route "/", so the app opens on it), Buy, Repair, My orders, Profile.
import { Tabs } from 'expo-router/js-tabs';
import { useColors } from '@fonzkart/ui';
import { FonzkartTabBar } from '../../src/navigation/TabBar';

// Android's back button retraces the tabs visited, then leaves the app.
export default function TabsLayout() {
  const colors = useColors();
  return (
    <Tabs
      backBehavior="history"
      tabBar={props => <FonzkartTabBar {...props} />}
      screenOptions={{
        animation: 'shift',
        headerTintColor: colors.green,
        headerTitleStyle: { fontWeight: '700', color: colors.navy },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.surface },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Sell', headerShown: false }} />
      <Tabs.Screen name="buy" options={{ title: 'Buy' }} />
      <Tabs.Screen name="repair" options={{ title: 'Repair' }} />
      <Tabs.Screen name="orders" options={{ title: 'My orders' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
