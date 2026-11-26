import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { MobileUser } from '../auth/AuthProvider';

// Kept in sync with AuthProvider, which removes the token on logout.
const PUSH_TOKEN_KEY = 'dorfduesen_push_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

async function registerAdminPush(apiFetch: ApiFetch) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('access-requests', {
      name: 'Zugangsanfragen',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  const response = await apiFetch('/api/mobile/push-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform: Platform.OS }),
  });
  if (response.ok) await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
}

/** Admins receive a push for every new access request; tapping it opens the review screen. */
export function useAdminPush(user: MobileUser | null, apiFetch: ApiFetch) {
  const router = useRouter();
  const admin = user?.role === 'ADMIN';

  useEffect(() => {
    if (!admin) return;
    // Push is optional: simulators, missing push credentials or a denied permission must not break the app.
    registerAdminPush(apiFetch).catch((error: unknown) => console.warn('Push registration failed:', error));
  }, [admin, apiFetch]);

  useEffect(() => {
    if (!admin) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (response?.notification.request.content.data?.type === 'ACCESS_REQUEST') router.push('/admin');
    };
    const initial = Notifications.getLastNotificationResponse();
    if (initial) {
      open(initial);
      Notifications.clearLastNotificationResponse();
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [admin, router]);
}
