import { Redirect, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../src/auth/AuthProvider';

type AccessRequest = {
  id: string;
  stravaAthleteId: string;
  firstname: string | null;
  lastname: string | null;
  username: string | null;
  profile: string | null;
  city: string | null;
  status: 'PENDING' | 'REJECTED';
  attemptCount: number;
  lastAttemptAt: string;
};

type Overview = { pending: AccessRequest[]; rejected: AccessRequest[] };

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' });

function personName(request: AccessRequest) {
  return [request.firstname, request.lastname].filter(Boolean).join(' ') || request.username || 'Unbekannt';
}

export default function AdminScreen() {
  const { status, user, apiFetch } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => apiFetch('/api/admin/access', { cache: 'no-store' })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({})) as Partial<Overview> & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Anfragen konnten nicht geladen werden.');
      setOverview({ pending: payload.pending ?? [], rejected: payload.rejected ?? [] });
      setError(null);
    })
    .catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'Anfragen konnten nicht geladen werden.');
    })
    .finally(() => setLoading(false)), [apiFetch]);

  useEffect(() => { if (user?.role === 'ADMIN') void load(); }, [load, user?.role]);

  if (status === 'anonymous') return <Redirect href="/" />;
  if (status === 'authenticated' && user?.role !== 'ADMIN') return <Redirect href="/(tabs)/dashboard" />;

  const decide = async (request: AccessRequest, action: 'approve' | 'reject') => {
    setBusyId(request.id);
    try {
      const response = await apiFetch(`/api/admin/access/${request.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Die Aktion ist fehlgeschlagen.');
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Die Aktion ist fehlgeschlagen.');
    } finally {
      setBusyId(null);
    }
  };

  const renderRequest = (request: AccessRequest) => {
    const rejected = request.status === 'REJECTED';
    const busy = busyId === request.id;
    return (
      <View key={request.id} style={styles.card}>
        <View style={styles.person}>
          {request.profile
            ? <Image source={{ uri: request.profile }} alt="" style={styles.avatar} />
            : <View style={[styles.avatar, styles.avatarPlaceholder]}><Text style={styles.initial}>{personName(request).slice(0, 1)}</Text></View>}
          <View style={styles.personText}>
            <Text style={styles.name} numberOfLines={1}>{personName(request)}</Text>
            <Text style={styles.meta} numberOfLines={1}>{[request.city, `Strava ${request.stravaAthleteId}`].filter(Boolean).join(' · ')}</Text>
            <Text style={styles.meta}>
              {request.attemptCount > 0
                ? `${dateFormat.format(new Date(request.lastAttemptAt))} · ${request.attemptCount} ${request.attemptCount === 1 ? 'Versuch' : 'Versuche'}`
                : 'Als Mitglied entfernt'}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void decide(request, 'approve')}
            style={({ pressed }) => [styles.button, styles.approve, (pressed || busy) && styles.pressed]}>
            <Text style={styles.buttonText}>{rejected ? 'Doch freigeben' : 'Freigeben'}</Text>
          </Pressable>
          {!rejected ? (
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void decide(request, 'reject')}
              style={({ pressed }) => [styles.button, styles.reject, (pressed || busy) && styles.pressed]}>
              <Text style={styles.rejectText}>Ablehnen</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Zugangsanfragen', headerStyle: { backgroundColor: '#09090b' }, headerTintColor: '#fafafa' }} />
      <ScrollView style={styles.page} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading && overview !== null} onRefresh={() => { setLoading(true); void load(); }} tintColor="#fc5200" />}>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {!overview && loading ? <ActivityIndicator color="#fc5200" style={styles.spinner} /> : null}
        {overview ? (
          <>
            <Text style={styles.section}>Offene Anfragen ({overview.pending.length})</Text>
            {overview.pending.length ? overview.pending.map(renderRequest) : <Text style={styles.empty}>Keine offenen Anfragen.</Text>}
            <Text style={styles.section}>Abgelehnt ({overview.rejected.length})</Text>
            {overview.rejected.length ? overview.rejected.map(renderRequest) : <Text style={styles.empty}>Keine abgelehnten Anmeldeversuche.</Text>}
            <Text style={styles.hint}>Mitglieder entfernen kannst du in der Web-Oberfläche unter dorfduesen.de/admin.</Text>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#09090b' },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  spinner: { marginTop: 40 },
  section: { color: '#a1a1aa', fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 12 },
  empty: { color: '#71717a', fontSize: 14, borderWidth: 1, borderColor: '#27272a', borderRadius: 14, padding: 16 },
  card: { backgroundColor: '#18181b', borderColor: '#27272a', borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  personText: { flex: 1, minWidth: 0 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#a1a1aa', fontWeight: '800', fontSize: 16 },
  name: { color: '#fafafa', fontSize: 16, fontWeight: '800' },
  meta: { color: '#a1a1aa', fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, alignItems: 'center', borderRadius: 12, paddingVertical: 12 },
  approve: { backgroundColor: '#059669' },
  reject: { borderWidth: 1, borderColor: '#3f3f46' },
  pressed: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  rejectText: { color: '#e4e4e7', fontWeight: '800', fontSize: 14 },
  error: { color: '#fca5a5', fontSize: 13, lineHeight: 19 },
  hint: { color: '#71717a', fontSize: 12, lineHeight: 18, marginTop: 16, textAlign: 'center' },
});
