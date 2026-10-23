import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../auth/AuthProvider';
import { DEFAULT_HEALTH_TYPES, importHealthData } from '../health/healthSync';

export function HealthConnectPrompt() {
  const { apiFetch, user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const choiceKey = `dorfduesen_health_prompt_v1:${user.id}`;
      if (await SecureStore.getItemAsync(choiceKey)) return;
      try {
        const response = await apiFetch('/api/mobile/health/status');
        if (!response.ok) return;
        const payload = await response.json() as { connections?: Array<{ consentedTypes: string[]; revokedAt: string | null }> };
        const activeConnection = payload.connections?.some(connection => !connection.revokedAt && connection.consentedTypes.length > 0);
        if (!cancelled && !activeConnection) setVisible(true);
        if (activeConnection) await SecureStore.setItemAsync(choiceKey, 'connected');
      } catch {
        // The regular physiology panel remains available if status cannot be loaded.
      }
    })();
    return () => { cancelled = true; };
  }, [apiFetch, user]);

  async function defer() {
    if (user) await SecureStore.setItemAsync(`dorfduesen_health_prompt_v1:${user.id}`, 'deferred');
    setVisible(false);
  }

  async function connect() {
    if (!user) return;
    setBusy(true); setError(null);
    try {
      await importHealthData(apiFetch, DEFAULT_HEALTH_TYPES);
      await SecureStore.setItemAsync(`dorfduesen_health_prompt_v1:${user.id}`, 'connected');
      setVisible(false);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Die Verbindung konnte nicht eingerichtet werden.');
    } finally {
      setBusy(false);
    }
  }

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => void defer()}>
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#000b' }}>
      <View style={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderWidth: 1, borderRadius: 20, padding: 20, gap: 12 }}>
        <Text style={{ color: '#fafafa', fontSize: 20, fontWeight: '900' }}>Health verbinden</Text>
        <Text style={{ color: '#d4d4d8', fontSize: 14, lineHeight: 21 }}>
          Verbinde Apple Health oder Health Connect, damit Dorfdüsen Trainings-, Belastungs-, Schlaf- und Vitaldaten mit deinen Strava-Aktivitäten auswerten kann. Dein Gerät fragt dich anschließend, welche Daten die App lesen darf. Mit „Verbinden“ stimmst du außerdem zu, dass lesbare Daten zu deinem Dorfdüsen-Konto übertragen und dort gespeichert werden. Sie werden nicht mit dem Team geteilt.
        </Text>
        <Text style={{ color: '#a1a1aa', fontSize: 12, lineHeight: 18 }}>Du kannst die Verbindung später in Physiologie trennen und importierte Daten löschen.</Text>
        {error ? <Text accessibilityLiveRegion="assertive" style={{ color: '#fca5a5', fontSize: 12 }}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void connect()} style={{ backgroundColor: '#ea580c', borderRadius: 12, minHeight: 48, justifyContent: 'center', alignItems: 'center' }}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Verbinden & synchronisieren</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void defer()} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#d4d4d8', fontWeight: '700' }}>Später</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}
