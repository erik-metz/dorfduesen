import { Redirect, Tabs, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../src/auth/AuthProvider';
import { HealthConnectPrompt } from '../../src/components/HealthConnectPrompt';
import { useStravaVisitSync } from '../../src/strava/stravaSync';
import { AppVersionBadge } from '../../src/updates/AppUpdates';
import { useAdminPush } from '../../src/push/AdminPush';

export default function TabsLayout() {
  const { status, user, apiFetch } = useAuth();
  const router = useRouter();
  useStravaVisitSync(apiFetch, status === 'authenticated');
  useAdminPush(status === 'authenticated' ? user : null, apiFetch);
  if (status !== 'authenticated') return <Redirect href="/" />;

  return (
    <>
      <Tabs screenOptions={{
        headerStyle: { backgroundColor: '#09090b' },
        headerTintColor: '#fafafa',
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {user?.role === 'ADMIN' ? (
              <Pressable onPress={() => router.push('/admin')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Zugangsanfragen öffnen">
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path d="M15 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M8.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 1 2 2 4-4" stroke="#fc7a3d" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Pressable>
            ) : null}
            <AppVersionBadge />
          </View>
        ),
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
