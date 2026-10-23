import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { DEFAULT_HEALTH_TYPES, importHealthData } from '../health/healthSync';

const card = { backgroundColor: '#09090b', borderColor: '#3f3f46', borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 } as const;

type HealthConnection = { provider: string; consentedTypes: string[]; revokedAt: string | null };

export function HealthDataPanel({ initialConnected = false, onConnectionChange }: { initialConnected?: boolean; onConnectionChange?: (connected: boolean) => void }) {
  const { apiFetch } = useAuth();
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(initialConnected);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await apiFetch('/api/mobile/health/status');
    if (!response.ok) return;
    const payload = await response.json() as { connections?: HealthConnection[] };
    const active = payload.connections?.find(connection => !connection.revokedAt && connection.consentedTypes.length > 0);
    const nextConnected = Boolean(active);
    setConnected(nextConnected);
    onConnectionChange?.(nextConnected);
  }, [apiFetch, onConnectionChange]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function connect() {
    setBusy(true); setError(null);
    try {
      await importHealthData(apiFetch, DEFAULT_HEALTH_TYPES);
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
          const response = await apiFetch('/api/mobile/health/status');
          const payload = await response.json() as { connections?: HealthConnection[] };
          const active = payload.connections?.find(connection => !connection.revokedAt);
          if (active) await apiFetch('/api/mobile/health/consent', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: active.provider, accepted: false }) });
          await refresh();
        } catch { setError('Die Verbindung konnte nicht getrennt werden.'); }
        finally { setBusy(false); }
      })(); } },
    ]);
  }

  return <View style={card}>
    <Text style={{ color: '#f4f4f5', fontSize: 16, fontWeight: '800' }}>{connected ? 'Health' : 'Health verbinden'}</Text>
    {!connected ? <Text style={{ color: '#a1a1aa', fontSize: 12, lineHeight: 18 }}>Kopple Apple Health oder Health Connect mit Dorfdüsen. Dein Gerät fragt dich, welche Gesundheitsdaten freigegeben werden dürfen.</Text> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => connected ? revoke() : void connect()} style={{ backgroundColor: connected ? '#27272a' : '#ea580c', borderColor: connected ? '#3f3f46' : '#ea580c', borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' }}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{connected ? 'Health-Verbindung trennen' : 'Health koppeln'}</Text>}
    </Pressable>
    {error ? <Text accessibilityLiveRegion="assertive" style={{ color: '#fca5a5', fontSize: 12 }}>{error}</Text> : null}
  </View>;
}
