import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Alert, DeviceEventEmitter, Pressable, Text, View } from 'react-native';
import { HealthRecordList } from './HealthRecordList';
import { useAuth } from '../auth/AuthProvider';
import { connectDeviceHealth, deviceHealthProvider, HEALTH_CONNECTION_CHANGED, HEALTH_SYNC_COMPLETED, healthCursorKey, withHealthTimeout } from '../health/healthSync';

const card = { backgroundColor: '#09090b', borderColor: '#3f3f46', borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 } as const;

type HealthConnection = { provider: string; consentedTypes: string[]; revokedAt: string | null; lastSyncedAt: string | null };
type HealthStatus = { connections: HealthConnection[]; storedRecordCount: number; recordTypes?: Array<{ type: string; count: number }> };
const providerName = (provider: string) => provider === 'APPLE_HEALTH' ? 'Apple Health' : 'Health Connect';

const STATUS_PATH = '/api/mobile/health/status?includeRecordTypes=1';

export function HealthDataPanel({ refreshRevision }: { refreshRevision: number }) {
  const { apiFetch, getCachedJson, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [localState, setLocalState] = useState<string | null>(null);
  const [updated, setUpdated] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id;
  const loadVersion = useRef(0);
  const previousRevision = useRef(refreshRevision);
  const connected = Boolean(localState && status?.connections.some(item => item.provider === deviceHealthProvider && !item.revokedAt && item.consentedTypes.length));

  const refresh = useCallback(async (force = false) => {
    if (!userId) return;
    const version = ++loadVersion.current;
    const [snapshot, state] = await Promise.all([
      getCachedJson<HealthStatus>(STATUS_PATH),
      AsyncStorage.getItem(healthCursorKey(userId)).catch(() => null),
    ]);
    if (version !== loadVersion.current) return;
    setLocalState(state);
    if (snapshot) setStatus(snapshot);
    const response = await apiFetch(STATUS_PATH, force ? { cache: 'reload' } : undefined);
    if (!response.ok) throw new Error('Der Health-Status konnte nicht geladen werden.');
    const payload: HealthStatus = await response.json();
    if (version === loadVersion.current) {
      setStatus(payload);
      setError(null);
    }
  }, [apiFetch, getCachedJson, userId]);

  useEffect(() => {
    const reload = (force = false) => void refresh(force).catch(() => setError('Der Health-Status konnte nicht geladen werden.'));
    const force = previousRevision.current !== refreshRevision;
    previousRevision.current = refreshRevision;
    reload(force);
    if (force) setUpdated(value => value + 1);
    const subscriptions = [HEALTH_CONNECTION_CHANGED, HEALTH_SYNC_COMPLETED].map(event => DeviceEventEmitter.addListener(event, (accountId: string) => {
      if (accountId !== userId) return;
      reload(true);
      if (event === HEALTH_SYNC_COMPLETED) setUpdated(value => value + 1);
    }));
    return () => {
      loadVersion.current += 1;
      subscriptions.forEach(subscription => subscription.remove());
    };
  }, [refresh, refreshRevision, userId]);

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
    <Text style={{ color: '#f4f4f5', fontSize: 16, fontWeight: '800' }}>Importstatus</Text>
    {status ? <>
      <Text style={{ color: '#fafafa', fontSize: 20, fontWeight: '800' }}>{status.storedRecordCount.toLocaleString('de-DE')} gespeicherte Datensätze</Text>
      {status.connections.map(item => <Text key={item.provider} style={{ color: '#d4d4d8', fontSize: 13 }}>
        {providerName(item.provider)} · {item.revokedAt ? 'Getrennt' : 'Freigabe gespeichert'}
        {'\n'}Letzter abgeschlossener Sync: {item.lastSyncedAt ? new Date(item.lastSyncedAt).toLocaleString('de-DE') : 'noch keiner'}
      </Text>)}
      {localState === 'pending' && connected ? <Text style={{ color: '#fdba74', fontSize: 13 }}>Erster Import ausstehend oder läuft. Lass Dorfdüsen dafür geöffnet.</Text> : null}
      {status.storedRecordCount === 0 ? <Text style={{ color: '#a1a1aa', fontSize: 13 }}>Sobald die App freigegebene Messwerte gespeichert hat, erscheinen sie hier.</Text> : null}
    </> : !error ? <ActivityIndicator color="#fc7a3d" /> : null}
    {status && !connected ? <Text style={{ color: '#a1a1aa', fontSize: 12, lineHeight: 18 }}>Kopple die Gesundheits-App dieses Geräts und erlaube Dorfdüsen, die freigegebenen Werte zu speichern. Importierte Workouts können in der Düsen-Arena erscheinen. Andere Gesundheitswerte bleiben privat.</Text> : null}
    {status && deviceHealthProvider ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => connected ? revoke() : void connect()} style={{ backgroundColor: connected ? '#27272a' : '#ea580c', padding: 12, borderRadius: 10, alignItems: 'center' }}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{connected ? 'Health-Verbindung trennen' : `${providerName(deviceHealthProvider)} koppeln`}</Text>}
    </Pressable> : null}
    <Pressable accessibilityRole="button" onPress={() => {
      setError(null);
      void refresh(true).then(() => setUpdated(value => value + 1)).catch(() => setError('Der Health-Status konnte nicht geladen werden.'));
    }} style={{ paddingVertical: 8 }}>
      <Text style={{ color: '#fdba74', fontWeight: '700' }}>Anzeige aktualisieren</Text>
    </Pressable>
    {error ? <Text accessibilityLiveRegion="polite" style={{ color: '#fca5a5', fontSize: 12 }}>{error}</Text> : null}
    {status && status.storedRecordCount > 0 ? <HealthRecordList revision={updated} types={status.recordTypes ?? []} /> : null}
  </View>;
}
