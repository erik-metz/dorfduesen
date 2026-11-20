import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthProvider';
import { connectDeviceHealth, DEFAULT_HEALTH_TYPES, deviceHealthProvider, healthCursorKey, HealthReadPermissionError, importHealthData } from '../health/healthSync';

const SYNC_INTERVAL_MS = 30 * 60 * 1000;
const OVERLAP_MS = 2 * 60 * 60 * 1000;

type Connection = { provider: string; consentedTypes: string[]; revokedAt: string | null };

export function HealthConnectPrompt() {
  const { apiFetch, user } = useAuth();
  const userId = user?.id;
  const provider = deviceHealthProvider;
  const providerName = provider === 'APPLE_HEALTH' ? 'Apple Health' : 'Health Connect';
  const cursorKey = userId && provider ? healthCursorKey(userId) : null;
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const work = useRef<AbortController | null>(null);
  const lastAttempt = useRef(0);
  const dismissed = useRef(false);

  const sync = useCallback(async (connect = false) => {
    if (!userId || !cursorKey || work.current || AppState.currentState === 'background') return;
    const startedAt = Date.now();
    if (!connect && startedAt - lastAttempt.current < SYNC_INTERVAL_MS) return;

    const controller = new AbortController();
    work.current = controller;
    lastAttempt.current = startedAt;
    const { signal } = controller;
    const request: typeof apiFetch = (path, init) => {
      if (signal.aborted) throw new Error('Health-Synchronisierung abgebrochen.');
      return apiFetch(path, { ...init, signal });
    };

    if (connect) {
      setBusy(true);
      setError(null);
    }
    try {
      if (connect) {
        await connectDeviceHealth(request, userId, signal);
      } else {
        const response = await request('/api/mobile/health/status', { cache: 'no-store' });
        if (!response.ok || signal.aborted) return;
        const { connections } = await response.json() as { connections?: Connection[] };
        if (signal.aborted) return;
        const connection = connections?.find(item => item.provider === provider);
        if (connection?.revokedAt) {
          await AsyncStorage.removeItem(cursorKey).catch(() => undefined);
          return;
        }
        const storedCursor = Number(await AsyncStorage.getItem(cursorKey).catch(() => null));
        if (signal.aborted) return;
        if (!connection || !connection.consentedTypes.length || !(storedCursor > 0 && storedCursor <= startedAt)) {
          if (!dismissed.current) setVisible(true);
          return;
        }
        if (startedAt - storedCursor < SYNC_INTERVAL_MS) return;
        const types = DEFAULT_HEALTH_TYPES.filter(type => connection.consentedTypes.includes(type));
        if (!types.length) return;
        await importHealthData(request, types, {
          since: new Date(storedCursor - OVERLAP_MS),
          requestPermissions: false,
          saveConsent: false,
          signal,
          accountId: userId,
        });
        if (signal.aborted) return;
        await AsyncStorage.setItem(cursorKey, String(startedAt));
      }
      if (!signal.aborted) setVisible(false);
    } catch (syncError) {
      if (signal.aborted) return;
      if (connect) setError(syncError instanceof Error ? syncError.message : 'Die Verbindung konnte nicht eingerichtet werden.');
      else if (syncError instanceof HealthReadPermissionError && !dismissed.current) setVisible(true);
      else console.warn('Automatischer Health-Import fehlgeschlagen.');
    } finally {
      if (work.current === controller) {
        work.current = null;
        if (connect) setBusy(false);
      }
    }
  }, [apiFetch, cursorKey, provider, userId]);

  useEffect(() => {
    if (!cursorKey) return;
    void sync();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void sync();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void sync();
    }, SYNC_INTERVAL_MS);
    return () => {
      subscription.remove();
      clearInterval(timer);
      work.current?.abort();
      work.current = null;
      lastAttempt.current = 0;
      dismissed.current = false;
    };
  }, [cursorKey, sync]);

  function defer() {
    if (busy) return;
    dismissed.current = true;
    setVisible(false);
  }

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={defer}>
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#000b' }}>
      <View style={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderWidth: 1, borderRadius: 20, padding: 20, gap: 12 }}>
        <Text style={{ color: '#fafafa', fontSize: 20, fontWeight: '900' }}>{providerName} koppeln</Text>
        <Text style={{ color: '#d4d4d8', fontSize: 14, lineHeight: 21 }}>
          Kopple {providerName} mit Dorfdüsen, damit Trainings-, Schlaf- und Vitaldaten in deine persönliche Auswertung einfließen. Dein Gerät fragt dich, welche Daten freigegeben werden dürfen. Mit „{providerName} koppeln“ stimmst du außerdem zu, dass diese Daten in deinem Dorfdüsen-Konto gespeichert werden. Health-Workouts erscheinen mit Sportart, Zeit und verfügbarer Distanz in deiner Aktivitätenliste und der Düsen-Arena. Andere Vital- und Gesundheitswerte bleiben privat.
        </Text>
        <Text style={{ color: '#a1a1aa', fontSize: 12, lineHeight: 18 }}>Du kannst die Kopplung später in Physiologie trennen. Bereits abgelehnte Freigaben änderst du direkt in {providerName}.</Text>
        {error ? <Text accessibilityLiveRegion="assertive" style={{ color: '#fca5a5', fontSize: 12 }}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void sync(true)} style={{ backgroundColor: '#ea580c', borderRadius: 12, minHeight: 48, justifyContent: 'center', alignItems: 'center' }}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{providerName} koppeln</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={defer} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#d4d4d8', fontWeight: '700' }}>Später</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}
