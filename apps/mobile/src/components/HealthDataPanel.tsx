import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { DEFAULT_HEALTH_TYPES, importHealthData } from '../health/healthSync';

const card = { backgroundColor: '#09090b', borderColor: '#3f3f46', borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 } as const;

type HealthConnection = { provider: string; consentedTypes: string[]; revokedAt: string | null; lastSyncedAt: string | null };

export function HealthDataPanel() {
  const { apiFetch } = useAuth();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Noch nicht verbunden');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await apiFetch('/api/mobile/health/status');
    if (!response.ok) return;
    const payload = await response.json() as { connections?: HealthConnection[] };
    const active = payload.connections?.find(connection => !connection.revokedAt && connection.consentedTypes.length > 0);
    setConnected(Boolean(active));
    setStatus(active
      ? `Einrichtung erfolgt · zuletzt synchronisiert ${active.lastSyncedAt ? new Date(active.lastSyncedAt).toLocaleString('de-DE') : 'noch nicht'}`
      : 'Noch nicht verbunden');
  }, [apiFetch]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function sync() {
    setBusy(true); setError(null);
    try {
      const result = await importHealthData(apiFetch, DEFAULT_HEALTH_TYPES);
      setStatus(`${result.saved} Gesundheitsdatensätze gespeichert`);
      await refresh();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Synchronisierung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  function revoke() {
    Alert.alert('Health-Daten trennen?', 'Die App beendet weitere Synchronisierungen. Bereits gespeicherte Daten kannst du separat löschen.', [
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

  function deleteData() {
    Alert.alert('Gespeicherte Health-Daten löschen?', 'Alle aus Apple Health oder Health Connect importierten Datensätze deines Kontos werden gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Daten löschen', style: 'destructive', onPress: () => { void (async () => {
        setBusy(true);
        try {
          const response = await apiFetch('/api/mobile/health/status');
          const payload = await response.json() as { connections?: HealthConnection[] };
          const connections = payload.connections ?? [];
          if (connections.length) {
            for (const connection of connections) {
              const revoked = await apiFetch('/api/mobile/health/consent', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: connection.provider, accepted: false, deleteRecords: true }) });
              if (!revoked.ok) throw new Error();
            }
          } else {
            const deleted = await apiFetch('/api/mobile/health/records', { method: 'DELETE' });
            if (!deleted.ok) throw new Error();
          }
          setError(null); setStatus('Importierte Daten gelöscht');
          await refresh();
        } catch { setError('Die Daten konnten nicht gelöscht werden.'); }
        finally { setBusy(false); }
      })(); } },
    ]);
  }

  return <View style={card}>
    <Text style={{ color: '#f4f4f5', fontSize: 16, fontWeight: '800' }}>Health-Verbindung</Text>
    <Text style={{ color: '#a1a1aa', fontSize: 12, lineHeight: 18 }}>Verbinde Apple Health oder Health Connect, um Trainings-, Belastungs- und Vitalwerte mit deinen Strava-Daten in deiner persönlichen Auswertung zu kombinieren. Welche Daten lesbar sind, steuerst du in den Systemeinstellungen deines Geräts.</Text>
    <Text accessibilityLiveRegion="polite" style={{ color: '#fb923c', fontSize: 12, fontWeight: '700' }}>{status}</Text>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void sync()} style={{ backgroundColor: '#ea580c', borderRadius: 10, padding: 12, alignItems: 'center' }}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{connected ? 'Jetzt synchronisieren' : 'Health verbinden & synchronisieren'}</Text>}
    </Pressable>
    {connected ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Pressable accessibilityRole="button" disabled={busy} onPress={revoke}><Text style={{ color: '#fb923c', fontSize: 12 }}>Verbindung trennen</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={deleteData}><Text style={{ color: '#f87171', fontSize: 12 }}>Importe löschen</Text></Pressable>
    </View> : null}
    {error ? <Text accessibilityLiveRegion="assertive" style={{ color: '#fca5a5', fontSize: 12 }}>{error}</Text> : null}
  </View>;
}
