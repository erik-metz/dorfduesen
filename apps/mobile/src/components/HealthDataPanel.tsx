import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { HEALTH_TYPE_GROUPS, HEALTH_TYPE_LABELS, importHealthData } from '../health/healthSync';
import type { HealthRecordType } from '../health/healthSync';

const card = { backgroundColor: '#09090b', borderColor: '#3f3f46', borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 } as const;

export function HealthDataPanel() {
  const { apiFetch } = useAuth();
  const allTypes = useMemo(() => HEALTH_TYPE_GROUPS.flatMap(group => group.types), []);
  const [selected, setSelected] = useState<HealthRecordType[]>(allTypes);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Noch nicht verbunden');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await apiFetch('/api/mobile/health/status');
    if (!response.ok) return;
    const payload = await response.json() as { connections?: Array<{ provider: string; consentedTypes: string[]; revokedAt: string | null; lastSyncedAt: string | null }> };
    const active = payload.connections?.find(connection => !connection.revokedAt && connection.consentedTypes.length > 0);
    setStatus(active ? `Verbunden · ${active.consentedTypes.length} Datentypen${active.lastSyncedAt ? ` · zuletzt ${new Date(active.lastSyncedAt).toLocaleString('de-DE')}` : ''}` : 'Noch nicht verbunden');
  }, [apiFetch]);

  useEffect(() => { void refresh(); }, [refresh]);

  function toggleType(type: HealthRecordType) {
    setSelected(current => current.includes(type) ? current.filter(item => item !== type) : [...current, type]);
  }

  async function sync() {
    if (!approved || selected.length === 0) return;
    setBusy(true); setError(null);
    try {
      const result = await importHealthData(apiFetch, selected);
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
          const payload = await response.json() as { connections?: Array<{ provider: string; revokedAt: string | null }> };
          const active = payload.connections?.find(connection => !connection.revokedAt);
          if (active) await apiFetch('/api/mobile/health/consent', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: active.provider, accepted: false }) });
          setApproved(false);
          await refresh();
        } catch { setError('Die Verbindung konnte nicht getrennt werden.'); }
        finally { setBusy(false); }
      })(); } },
    ]);
  }

  function deleteData() {
    Alert.alert('Gespeicherte Health-Daten löschen?', 'Alle aus HealthKit oder Health Connect importierten Datensätze deines Kontos werden gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Daten löschen', style: 'destructive', onPress: () => { void (async () => {
        setBusy(true);
        try {
          const response = await apiFetch('/api/mobile/health/status');
          const payload = await response.json() as { connections?: Array<{ provider: string; revokedAt: string | null }> };
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
    <Text style={{ color: '#f4f4f5', fontSize: 16, fontWeight: '800' }}>Health-Daten synchronisieren</Text>
    <Text style={{ color: '#a1a1aa', fontSize: 12, lineHeight: 18 }}>Wähle die Daten aus Apple Health oder Health Connect. Mit deiner Zustimmung werden sie zu Dorfdüsen übertragen und in deinem Konto gespeichert. Es werden keine Gesundheitsdaten mit dem Team geteilt.</Text>
    <Text style={{ color: '#fb923c', fontSize: 12, fontWeight: '700' }}>{status}</Text>
    <Pressable onPress={() => setSelected(selected.length === allTypes.length ? [] : allTypes)}><Text style={{ color: '#fb923c', fontSize: 12, fontWeight: '700' }}>{selected.length === allTypes.length ? 'Auswahl aufheben' : 'Alle unterstützten Daten auswählen'}</Text></Pressable>
    {HEALTH_TYPE_GROUPS.map(group => <View key={group.label} style={{ gap: 5 }}>
      <Text style={{ color: '#d4d4d8', fontSize: 12, fontWeight: '800', marginTop: 6 }}>{group.label}</Text>
      {group.types.map(type => <Pressable key={type} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(type) }} onPress={() => toggleType(type)} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 3 }}>
        <Text style={{ color: selected.includes(type) ? '#fb923c' : '#71717a', fontSize: 15 }}>{selected.includes(type) ? '☑' : '□'}</Text>
        <Text style={{ color: '#a1a1aa', fontSize: 12 }}>{HEALTH_TYPE_LABELS[type]}</Text>
      </Pressable>)}
    </View>)}
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: approved }} onPress={() => setApproved(value => !value)} style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start', borderTopWidth: 1, borderTopColor: '#27272a', paddingTop: 12, marginTop: 5 }}>
      <Text style={{ color: approved ? '#fb923c' : '#71717a', fontSize: 16 }}>{approved ? '☑' : '□'}</Text>
      <Text style={{ color: '#d4d4d8', fontSize: 12, flex: 1, lineHeight: 18 }}>Ich stimme zu, dass die ausgewählten Gesundheitsdaten von meinem Gerät an Dorfdüsen übertragen und in meiner Datenbank gespeichert werden. Ich kann die Zustimmung jederzeit widerrufen und die gespeicherten Imports löschen.</Text>
    </Pressable>
    <Pressable disabled={!approved || selected.length === 0 || busy} onPress={() => void sync()} style={{ backgroundColor: approved && selected.length ? '#ea580c' : '#3f3f46', borderRadius: 10, padding: 12, alignItems: 'center' }}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Ausgewählte Daten verbinden & synchronisieren</Text>}
    </Pressable>
    {status !== 'Noch nicht verbunden' ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Pressable onPress={revoke}><Text style={{ color: '#fb923c', fontSize: 12 }}>Verbindung trennen</Text></Pressable>
      <Pressable onPress={deleteData}><Text style={{ color: '#f87171', fontSize: 12 }}>Importe löschen</Text></Pressable>
    </View> : null}
    {error ? <Text style={{ color: '#fca5a5', fontSize: 12 }}>{error}</Text> : null}
  </View>;
}
