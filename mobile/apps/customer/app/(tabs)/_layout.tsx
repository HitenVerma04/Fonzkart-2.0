// The bottom tabs: Sell (the home screen, route "/", so the app opens on it), Buy, Repair, My orders, Profile. Each
// tab draws its own large title; the floating tab bar sits over the content.
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
      screenOptions={{ animation: 'shift', headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Sell' }} />
      <Tabs.Screen name="buy" options={{ title: 'Buy' }} />
      <Tabs.Screen name="repair" options={{ title: 'Repair' }} />
      <Tabs.Screen name="orders" options={{ title: 'My orders' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
