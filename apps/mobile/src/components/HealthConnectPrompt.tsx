import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ActivityIndicator, Modal, Pressable, Platform, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../auth/AuthProvider';
import { DEFAULT_HEALTH_TYPES, importHealthData } from '../health/healthSync';

function promptChoiceKey(userId: string) {
  const safeUserId = userId.replace(/[^A-Za-z0-9._-]/g, '_') || 'user';
  return `dorfduesen_health_prompt_v1_${safeUserId}`;
}

export function HealthConnectPrompt() {
  const { apiFetch, user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncInProgress = useRef(false);

  const checkConnectionAndSync = useCallback(async (cancelled?: () => boolean) => {
    if (!user || syncInProgress.current) return;
    syncInProgress.current = true;
    try {
      const response = await apiFetch('/api/mobile/health/status');
      if (!response.ok || cancelled?.()) return;
      const payload = await response.json() as { connections?: Array<{ provider: string; consentedTypes: string[]; revokedAt: string | null; lastSyncedAt: string | null }> };
      const provider = Platform.OS === 'ios' ? 'APPLE_HEALTH' : Platform.OS === 'android' ? 'HEALTH_CONNECT' : null;
      const activeConnection = payload.connections?.find(connection => connection.provider === provider && !connection.revokedAt && connection.consentedTypes.length > 0);
      if (!activeConnection) return;

      const lastSyncedAt = activeConnection.lastSyncedAt ? Date.parse(activeConnection.lastSyncedAt) : 0;
      const staleAfterMs = 15 * 60 * 1000;
      if (Date.now() - lastSyncedAt < staleAfterMs) return;

      // Re-read a day before the previous cursor to catch records completed
      // shortly after the last app session. Stable native IDs make this safe
      // to upsert without creating duplicate rows.
      const overlapMs = 24 * 60 * 60 * 1000;
      const defaultLookbackMs = Platform.OS === 'android' ? 30 * 24 * 60 * 60 * 1000 : 365 * 24 * 60 * 60 * 1000;
      const since = lastSyncedAt ? new Date(lastSyncedAt - overlapMs) : new Date(Date.now() - defaultLookbackMs);
      const permittedTypes = DEFAULT_HEALTH_TYPES.filter(type => activeConnection.consentedTypes.includes(type));
      if (!permittedTypes.length) return;

      await importHealthData(apiFetch, permittedTypes, { since, requestPermissions: false, saveConsent: false });
    } catch (syncError) {
      // A background refresh should never block navigation or show a modal.
      console.warn('Automatischer Health-Import fehlgeschlagen.', syncError instanceof Error ? syncError.message : 'Unbekannter Fehler');
    } finally {
      syncInProgress.current = false;
    }
  }, [apiFetch, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await apiFetch('/api/mobile/health/status');
        if (!response.ok) return;
        const payload = await response.json() as { connections?: Array<{ provider: string; consentedTypes: string[]; revokedAt: string | null }> };
        const provider = Platform.OS === 'ios' ? 'APPLE_HEALTH' : Platform.OS === 'android' ? 'HEALTH_CONNECT' : null;
        const activeConnection = payload.connections?.some(connection => connection.provider === provider && !connection.revokedAt && connection.consentedTypes.length > 0);
        if (!activeConnection) {
          const choice = await SecureStore.getItemAsync(promptChoiceKey(user.id));
          if (!cancelled && !choice) setVisible(true);
          return;
        }
        await SecureStore.setItemAsync(promptChoiceKey(user.id), 'connected');
        await checkConnectionAndSync(() => cancelled);
      } catch {
        // The regular physiology panel remains available if status cannot be loaded.
      }
    })();
    return () => { cancelled = true; };
  }, [apiFetch, checkConnectionAndSync, user]);

  useEffect(() => {
    if (!user) return;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void checkConnectionAndSync();
    });
    return () => subscription.remove();
  }, [checkConnectionAndSync, user]);

  async function defer() {
    if (user) {
      try { await SecureStore.setItemAsync(promptChoiceKey(user.id), 'deferred'); } catch { /* Dismissing the optional prompt must not block the app. */ }
    }
    setVisible(false);
  }

  async function connect() {
    if (!user) return;
    setBusy(true); setError(null);
    try {
      await importHealthData(apiFetch, DEFAULT_HEALTH_TYPES, { requestPermissions: true, saveConsent: true });
      try { await SecureStore.setItemAsync(promptChoiceKey(user.id), 'connected'); } catch { /* A storage failure must not undo a successful Health import. */ }
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
        <Text style={{ color: '#fafafa', fontSize: 20, fontWeight: '900' }}>Health koppeln</Text>
        <Text style={{ color: '#d4d4d8', fontSize: 14, lineHeight: 21 }}>
          Kopple Apple Health oder Health Connect mit Dorfdüsen, damit Trainings-, Schlaf- und Vitaldaten in deine persönliche Auswertung einfließen. Dein Gerät fragt dich, welche Daten freigegeben werden dürfen. Mit „Health koppeln“ stimmst du außerdem zu, dass diese Daten in deinem Dorfdüsen-Konto gespeichert werden. Health-Workouts erscheinen mit Sportart, Zeit und verfügbarer Distanz in deiner Aktivitätenliste und der Düsen-Arena. Andere Vital- und Gesundheitswerte bleiben privat.
        </Text>
        <Text style={{ color: '#a1a1aa', fontSize: 12, lineHeight: 18 }}>Du kannst die Kopplung später in Physiologie wieder trennen.</Text>
        {error ? <Text accessibilityLiveRegion="assertive" style={{ color: '#fca5a5', fontSize: 12 }}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void connect()} style={{ backgroundColor: '#ea580c', borderRadius: 12, minHeight: 48, justifyContent: 'center', alignItems: 'center' }}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Health koppeln</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void defer()} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#d4d4d8', fontWeight: '700' }}>Später</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}
