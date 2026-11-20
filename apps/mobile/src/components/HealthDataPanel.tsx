import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Alert, DeviceEventEmitter, Pressable, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { connectDeviceHealth, deviceHealthProvider, HEALTH_CONNECTION_CHANGED, healthCursorKey, withHealthTimeout } from '../health/healthSync';

const card = { backgroundColor: '#09090b', borderColor: '#3f3f46', borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 } as const;

type HealthConnection = { provider: string; consentedTypes: string[]; revokedAt: string | null };

export function HealthDataPanel({ initialConnected = false, onConnectionChange }: { initialConnected?: boolean; onConnectionChange?: (connected: boolean) => void }) {
  const { apiFetch, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(initialConnected);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await apiFetch('/api/mobile/health/status', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json() as { connections?: HealthConnection[] };
    const active = payload.connections?.find(connection => connection.provider === deviceHealthProvider && !connection.revokedAt && connection.consentedTypes.length > 0);
    const nextConnected = Boolean(active && user && await AsyncStorage.getItem(healthCursorKey(user.id)));
    setConnected(nextConnected);
    onConnectionChange?.(nextConnected);
  }, [apiFetch, onConnectionChange, user]);

  useEffect(() => {
    void refresh().catch(() => undefined);
    const subscription = DeviceEventEmitter.addListener(HEALTH_CONNECTION_CHANGED, (userId: string) => {
      if (user?.id !== userId) return;
      setConnected(true);
      onConnectionChange?.(true);
    });
    return () => subscription.remove();
  }, [onConnectionChange, refresh, user?.id]);

  async function connect() {
    if (!user) return;
    setBusy(true); setError(null);
    try {
      const controller = new AbortController();
      await withHealthTimeout(controller, 120_000, () => connectDeviceHealth(
        (path, init) => apiFetch(path, { ...init, signal: controller.signal }),
        user.id,
        controller.signal,
      ));
      await refresh();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Health konnte nicht verbunden werden.');
    } finally {
      setBusy(false);
    }
  }

  function revoke() {
    Alert.alert('Health-Verbindung trennen?', 'Dorfdüsen beendet den Zugriff auf Apple Health oder Health Connect. Bereits importierte Daten bleiben in deinem Konto gespeichert.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Trennen', style: 'destructive', onPress: () => { void (async () => {
        setBusy(true);
        try {
          if (!deviceHealthProvider || !user) return;
          const response = await apiFetch('/api/mobile/health/consent', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: deviceHealthProvider, accepted: false, accountId: user.id }),
          });
          if (!response.ok) throw new Error('Die Verbindung konnte nicht getrennt werden.');
          await AsyncStorage.removeItem(healthCursorKey(user.id));
          await refresh();
        } catch { setError('Die Verbindung konnte nicht getrennt werden.'); }
        finally { setBusy(false); }
      })(); } },
    ]);
  }

  return <View style={card}>
    <Text style={{ color: '#f4f4f5', fontSize: 16, fontWeight: '800' }}>{connected ? 'Health' : 'Health verbinden'}</Text>
    {!connected ? <Text style={{ color: '#a1a1aa', fontSize: 12, lineHeight: 18 }}>Kopple Apple Health oder Health Connect mit Dorfdüsen. Dein Gerät fragt nach den Datentypen. Mit der Kopplung erlaubst du auch die Speicherung der freigegebenen Daten in deinem Dorfdüsen-Konto. Importierte Workouts können in der Düsen-Arena erscheinen. Andere Gesundheitswerte bleiben privat.</Text> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => connected ? revoke() : void connect()} style={{ backgroundColor: connected ? '#27272a' : '#ea580c', borderColor: connected ? '#3f3f46' : '#ea580c', borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' }}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{connected ? 'Health-Verbindung trennen' : 'Health koppeln'}</Text>}
    </Pressable>
    {error ? <Text accessibilityLiveRegion="assertive" style={{ color: '#fca5a5', fontSize: 12 }}>{error}</Text> : null}
  </View>;
}
