import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../src/auth/AuthProvider';
import { HealthConnectPrompt } from '../../src/components/HealthConnectPrompt';
import { useStravaVisitSync } from '../../src/strava/stravaSync';
import { AppVersionBadge } from '../../src/updates/AppUpdates';

export default function TabsLayout() {
  const { status, user, apiFetch } = useAuth();
  useStravaVisitSync(apiFetch, status === 'authenticated');
  if (status !== 'authenticated') return <Redirect href="/" />;

  return (
    <>
      <Tabs screenOptions={{
        headerStyle: { backgroundColor: '#09090b' },
        headerTintColor: '#fafafa',
        headerRight: () => <AppVersionBadge />,
        tabBarStyle: { backgroundColor: '#18181b', borderTopColor: '#27272a' },
        tabBarActiveTintColor: '#fc7a3d',
        tabBarInactiveTintColor: '#a1a1aa',
      }}>
        <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarLabel: 'Dashboard', tabBarIcon: ({ color }) => <Text style={{ color }}>●</Text> }} />
        <Tabs.Screen name="arena" options={{ title: 'Düsen-Arena', tabBarLabel: 'Arena', tabBarIcon: ({ color }) => <Text style={{ color }}>▲</Text> }} />
        <Tabs.Screen name="coach" options={{ title: 'Smart Coach', tabBarLabel: 'Coach', tabBarIcon: ({ color, size }) => (
          <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M4 5h16v11H9l-5 4V5Zm4 5h8m-8 3h5" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        ) }} />
      </Tabs>
      <HealthConnectPrompt key={user?.id} />
    </>
  );
}
