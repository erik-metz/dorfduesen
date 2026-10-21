import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '../../src/auth/AuthProvider';

export default function TabsLayout() {
  const { status } = useAuth();
  if (status !== 'authenticated') return <Redirect href="/" />;

  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: '#09090b' },
      headerTintColor: '#fafafa',
      tabBarStyle: { backgroundColor: '#18181b', borderTopColor: '#27272a' },
      tabBarActiveTintColor: '#fc7a3d',
      tabBarInactiveTintColor: '#a1a1aa',
    }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarLabel: 'Dashboard', tabBarIcon: ({ color }) => <Text style={{ color }}>●</Text> }} />
      <Tabs.Screen name="arena" options={{ title: 'Düsen-Arena', tabBarLabel: 'Arena', tabBarIcon: ({ color }) => <Text style={{ color }}>▲</Text> }} />
    </Tabs>
  );
}
