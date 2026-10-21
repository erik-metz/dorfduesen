import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';

type Activity = {
  id: string; stravaId: string; name: string; sportType: string; distance: number;
  manualDistance: number | null; movingTime: number; totalElevationGain: number; startDate: string;
  averageSpeed: number | null; averageHeartrate?: number | null;
};
type DashboardData = {
  user: { id: string; firstname: string | null; lastname: string | null; username: string | null; profile: string | null; city?: string | null; stravaAthleteId: string; activityCount: number; lastSync?: string | null };
  isReadOnly: boolean;
  activities: Activity[];
  stats: { totalDistanceKm: number; totalHours: number; totalElevation: number; activityCount: number };
  pagination: { page: number; pageCount: number; filteredCount: number; sport: string };
  physiology: { recentMetrics: Array<{ id: string; date: string; weightKg: number | null; restingHeartrate: number | null; notes: string | null }> };
  coach: { activePlan: null | { id: string; title: string; status: string; currentWeek: number; totalWeeks: number; endDate: string } };
  notifications: { unreadCount: number; latestUnread: { title: string } | null };
  arena: { weekKm: number; weekActivitiesCount: number; activeAthletesCount: number; weeklyGoal: { activeDays: number; targetActiveDays: number | null; nextWeekTargetActiveDays: number | null; nextWeekKey: string }; champions: Array<{ id: string; title: string; icon: string; isCurrentLeader: boolean }> };
};
type Member = { id: string; name: string; profile: string | null; city: string | null };
type DashboardTab = 'Aktivitäten' | 'Physiologie' | 'Coach' | 'Trophäen' | 'Hinweise';

const tabs: Array<{ key: DashboardTab; label: string; icon: string; badge?: string }> = [
  { key: 'Aktivitäten', label: 'Aktivitäten', icon: '👟' },
  { key: 'Physiologie', label: 'Physiologie & Zonen', icon: '♡' },
  { key: 'Trophäen', label: 'Trophäenschrank', icon: '🏆', badge: 'VITRINE' },
  { key: 'Coach', label: 'Smart Coach', icon: '✧', badge: 'KI' },
  { key: 'Hinweise', label: 'Mitteilungen', icon: '♧' },
];
const panel = { backgroundColor: '#18181b', borderColor: '#27272a', borderWidth: 1, borderRadius: 20, padding: 18 } as const;

async function responseJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Die Daten konnten nicht geladen werden.');
  return data as T;
}
function formatDistance(meters: number) { return `${(meters / 1000).toFixed(2)} km`; }
function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return hours ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}:${String(remainingSeconds).padStart(2, '0')}m`;
}
function formatPace(metersPerSecond: number | null, sportType: string) {
  if (!metersPerSecond || metersPerSecond <= 0) return '-';
  if (sportType.toLowerCase().includes('ride')) return `${(metersPerSecond * 3.6).toFixed(1)} km/h`;
  const paceSeconds = 1000 / metersPerSecond;
  return `${Math.floor(paceSeconds / 60)}:${String(Math.floor(paceSeconds % 60)).padStart(2, '0')} /km`;
}
function displayName(user: { firstname: string | null; lastname: string | null; username?: string | null }) {
  return [user.firstname, user.lastname].filter(Boolean).join(' ') || user.username || 'Dorfdüse';
}

export default function DashboardScreen() {
  const { user, logout, apiFetch } = useAuth();
  const params = useLocalSearchParams<{ userId?: string }>();
  const [tab, setTab] = useState<DashboardTab>('Aktivitäten');
  const [data, setData] = useState<DashboardData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [sport, setSport] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [activityDetail, setActivityDetail] = useState<Record<string, Record<string, unknown>>>({});
  const [sectionData, setSectionData] = useState<Record<string, unknown> | null>(null);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [restingHr, setRestingHr] = useState('');
  const [goalDays, setGoalDays] = useState(2);
  const [goalType, setGoalType] = useState('GENERAL_FITNESS');

  useEffect(() => {
    if (params.userId) setSelectedUserId(params.userId);
  }, [params.userId]);

  const loadDashboard = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sport });
      if (selectedUserId && selectedUserId !== user?.id) params.set('userId', selectedUserId);
      const payload = await responseJson<DashboardData>(await apiFetch(`/api/mobile/dashboard?${params}`));
      setData(payload);
      setGoalDays(payload.arena.weeklyGoal.nextWeekTargetActiveDays ?? 2);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Dashboard konnte nicht geladen werden.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiFetch, selectedUserId, sport, user?.id]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);
  useEffect(() => {
    let active = true;
    void apiFetch('/api/mobile/members').then(response => responseJson<{ members: Member[] }>(response))
      .then(result => { if (active) setMembers(result.members); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [apiFetch]);

  useEffect(() => {
    if (tab === 'Aktivitäten' || !data || data.isReadOnly && ['Physiologie', 'Coach', 'Trophäen', 'Hinweise'].includes(tab)) {
      setSectionData(null);
      return;
    }
    let active = true;
    setSectionLoading(true);
    setActionMessage(null);
    const load = async () => {
      if (tab === 'Physiologie') {
        const [metrics, profile] = await Promise.all([
          responseJson<{ metrics: DashboardData['physiology']['recentMetrics'] }>(await apiFetch('/api/coach/metrics')),
          responseJson<Record<string, unknown>>(await apiFetch('/api/coach/profile')),
        ]);
        return { metrics: metrics.metrics, ...profile };
      }
      if (tab === 'Coach') {
        const [plan, profile] = await Promise.all([
          responseJson<Record<string, unknown>>(await apiFetch('/api/coach/plan')),
          responseJson<Record<string, unknown>>(await apiFetch('/api/coach/profile')),
        ]);
        return { ...plan, ...profile };
      }
      if (tab === 'Trophäen') {
        const query = selectedUserId && selectedUserId !== user?.id ? `?userId=${encodeURIComponent(selectedUserId)}` : '';
        return responseJson<Record<string, unknown>>(await apiFetch(`/api/trophies${query}`));
      }
      return responseJson<Record<string, unknown>>(await apiFetch('/api/notifications'));
    };
    void load().then(result => { if (active) setSectionData(result); })
      .catch(loadError => { if (active) setActionMessage(loadError instanceof Error ? loadError.message : 'Bereich konnte nicht geladen werden.'); })
      .finally(() => { if (active) setSectionLoading(false); });
    return () => { active = false; };
  }, [apiFetch, data, selectedUserId, tab, user?.id]);

  const titleName = useMemo(() => data ? displayName(data.user) : user?.firstname || 'Dorfdüse', [data, user?.firstname]);
  const refresh = () => { setRefreshing(true); void loadDashboard(false); };

  async function loadMore() {
    if (!data || data.pagination.page >= data.pagination.pageCount) return;
    try {
      const params = new URLSearchParams({ page: String(data.pagination.page + 1), sport });
      if (selectedUserId && selectedUserId !== user?.id) params.set('userId', selectedUserId);
      const next = await responseJson<DashboardData>(await apiFetch(`/api/mobile/dashboard?${params}`));
      setData(current => current ? { ...next, activities: [...current.activities, ...next.activities] } : next);
    } catch (loadError) { setActionMessage(loadError instanceof Error ? loadError.message : 'Weitere Aktivitäten konnten nicht geladen werden.'); }
  }

  async function toggleActivity(activity: Activity) {
    if (expandedActivity === activity.stravaId) { setExpandedActivity(null); return; }
    setExpandedActivity(activity.stravaId);
    if (activityDetail[activity.stravaId]) return;
    try {
      const payload = await responseJson<{ activity: Record<string, unknown> }>(await apiFetch(`/api/strava/activities/${encodeURIComponent(activity.stravaId)}`));
      setActivityDetail(current => ({ ...current, [activity.stravaId]: payload.activity }));
    } catch (loadError) { setActionMessage(loadError instanceof Error ? loadError.message : 'Aktivitätsdetails konnten nicht geladen werden.'); }
  }

  async function addMetric() {
    setSectionLoading(true); setActionMessage(null);
    try {
      const body: Record<string, number> = {};
      if (weight.trim()) body.weightKg = Number(weight.replace(',', '.'));
      if (restingHr.trim()) body.restingHeartrate = Number(restingHr);
      if (!Object.keys(body).length || Object.values(body).some(value => !Number.isFinite(value) || value <= 0)) throw new Error('Bitte ein gültiges Gewicht oder einen Ruhepuls eingeben.');
      await responseJson(await apiFetch('/api/coach/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
      setWeight(''); setRestingHr(''); setActionMessage('Messwert gespeichert.');
      const metrics = await responseJson<{ metrics: DashboardData['physiology']['recentMetrics'] }>(await apiFetch('/api/coach/metrics'));
      setSectionData(current => ({ ...(current ?? {}), metrics: metrics.metrics }));
      void loadDashboard(false);
    } catch (saveError) { setActionMessage(saveError instanceof Error ? saveError.message : 'Messwert konnte nicht gespeichert werden.'); }
    finally { setSectionLoading(false); }
  }

  async function saveGoal() {
    setSectionLoading(true); setActionMessage(null);
    try {
      await responseJson(await apiFetch('/api/arena/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activeDays: goalDays }) }));
      setActionMessage('Wochenziel gespeichert.');
      void loadDashboard(false);
    } catch (saveError) { setActionMessage(saveError instanceof Error ? saveError.message : 'Wochenziel konnte nicht gespeichert werden.'); }
    finally { setSectionLoading(false); }
  }

  async function requestPlan() {
    setSectionLoading(true); setActionMessage(null);
    try {
      const profile = sectionData?.profile as Record<string, unknown> | undefined;
      await responseJson(await apiFetch('/api/coach/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalType, weeklyAvailability: Number(profile?.weeklyAvailability ?? 3) }),
      }));
      setActionMessage('Dein Trainingsplan wird erstellt.');
      const plan = await responseJson<Record<string, unknown>>(await apiFetch('/api/coach/plan'));
      setSectionData(current => ({ ...(current ?? {}), ...plan }));
    } catch (planError) { setActionMessage(planError instanceof Error ? planError.message : 'Trainingsplan konnte nicht angefordert werden.'); }
    finally { setSectionLoading(false); }
  }

  async function saveCoachProfile(values: { weeklyAvailability: number; preferredTerrain: string; includeSundayRun: boolean }) {
    setSectionLoading(true); setActionMessage(null);
    try {
      await responseJson(await apiFetch('/api/coach/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }));
      setActionMessage('Trainingsprofil gespeichert.');
      const profile = await responseJson<Record<string, unknown>>(await apiFetch('/api/coach/profile'));
      setSectionData(current => ({ ...(current ?? {}), ...profile }));
    } catch (saveError) { setActionMessage(saveError instanceof Error ? saveError.message : 'Trainingsprofil konnte nicht gespeichert werden.'); }
    finally { setSectionLoading(false); }
  }

  async function markNotification(notificationId?: string) {
    try {
      await responseJson(await apiFetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(notificationId ? { notificationId } : { all: true }) }));
      const notifications = await responseJson<Record<string, unknown>>(await apiFetch('/api/notifications'));
      setSectionData(notifications);
      void loadDashboard(false);
    } catch (markError) { setActionMessage(markError instanceof Error ? markError.message : 'Benachrichtigungen konnten nicht aktualisiert werden.'); }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#fc7a3d" />}>
      {members.length > 1 ? <View style={styles.memberPanel}>
        <View style={styles.memberHeading}><Text style={styles.memberHeadingText}>DORFDÜSEN TEAM ({members.length} ATHLETEN)</Text><Pressable accessibilityRole="button" onPress={() => void logout()}><Text style={styles.logout}>Abmelden</Text></Pressable></View>
        <View style={styles.memberGrid}>{members.map(member => <Pressable key={member.id} accessibilityRole="button" accessibilityState={{ selected: (selectedUserId ?? user?.id) === member.id }} style={[styles.memberChip, (selectedUserId ?? user?.id) === member.id && styles.memberChipActive]} onPress={() => { setSelectedUserId(member.id === user?.id ? null : member.id); setTab('Aktivitäten'); setSectionData(null); }}>
          {member.profile ? <Image source={{ uri: member.profile }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><Text style={styles.avatarLetter}>{member.name.slice(0, 1)}</Text></View>}
          <Text numberOfLines={1} style={styles.memberText}>{member.name}</Text>{member.id === user?.id ? <Text style={styles.youBadge}>Du</Text> : null}
        </Pressable>)}</View>
      </View> : <View style={styles.memberHeading}><Text style={styles.memberHeadingText}>DEIN TRAINING</Text><Pressable accessibilityRole="button" onPress={() => void logout()}><Text style={styles.logout}>Abmelden</Text></Pressable></View>}
      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void loadDashboard()}><Text style={styles.actionLink}>Erneut versuchen</Text></Pressable></View> : null}
      {loading && !data ? <ActivityIndicator color="#fc7a3d" size="large" style={{ marginTop: 40 }} /> : data ? <>
        <View style={styles.profileCard}>
          {data.user.profile ? <Image source={{ uri: data.user.profile }} style={styles.profileAvatar} /> : <View style={[styles.profileAvatar, styles.profileAvatarPlaceholder]}><Text style={styles.profileInitial}>{titleName.slice(0, 1)}</Text></View>}
          <View style={styles.profileInfo}>
            <View style={styles.profileMeta}><Text style={styles.verified}>VERIFIZIERT VIA STRAVA</Text>{data.user.city ? <Text style={styles.city}>{data.user.city}</Text> : null}</View>
            <Text style={styles.profileName}>{titleName}</Text>
            <Text style={styles.athleteId}>Strava Athlete ID: #{data.user.stravaAthleteId}</Text>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://www.strava.com/athletes/${encodeURIComponent(data.user.stravaAthleteId)}`)}><Text style={styles.stravaLink}>Strava Profil ↗</Text></Pressable>
          </View>
        </View>
        <View style={styles.tabGrid}>
          {tabs.filter(item => !(data.isReadOnly && item.key === 'Hinweise')).map(item => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: tab === item.key }} style={[styles.tab, tab === item.key && styles.tabActive]} onPress={() => setTab(item.key)}>
            <Text style={[styles.tabIcon, tab === item.key && styles.tabTextActive]}>{item.icon}</Text>
            <Text numberOfLines={1} style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.key === 'Aktivitäten' ? 'Aktivitäten' : item.key === 'Trophäen' ? 'Trophäen' : item.label}</Text>
            {item.key === 'Aktivitäten' ? <Text style={styles.tabBadge}>{data.stats.activityCount}</Text> : item.badge ? <Text style={[styles.tabBadge, item.badge === 'KI' && styles.tabBadgeOrange]}>{item.badge}</Text> : item.key === 'Hinweise' && data.notifications.unreadCount > 0 && !data.isReadOnly ? <Text style={styles.tabBadgeRed}>{data.notifications.unreadCount} NEU</Text> : null}
          </Pressable>)}
        </View>
        {tab === 'Aktivitäten' && data.notifications.unreadCount > 0 && !data.isReadOnly ? <View style={styles.notificationBanner}>
          <Text style={styles.notificationBell}>♧</Text><View style={styles.notificationCopy}><Text style={styles.notificationTitle}>{data.notifications.unreadCount} NEUE {data.notifications.unreadCount === 1 ? 'BENACHRICHTIGUNG' : 'BENACHRICHTIGUNGEN'}</Text><Text numberOfLines={1} style={styles.copy}>{data.notifications.latestUnread?.title ?? 'Neue Updates in der Arena oder bei deinen Badges.'}</Text></View><Pressable accessibilityRole="button" onPress={() => setTab('Hinweise')} style={styles.notificationButton}><Text style={styles.notificationButtonText}>Anzeigen ›</Text></Pressable>
        </View> : null}
        <View style={styles.statsGrid}>
          <StatCard label="Gesamtdistanz" value={`${data.stats.totalDistanceKm.toFixed(1)} km`} sub="In der Datenbank synchronisiert" />
          <StatCard label="Bewegungszeit" value={`${data.stats.totalHours.toFixed(1)} Std`} sub="Aktiv auf der Strecke" />
          <StatCard label="Höhenmeter" value={`${Math.round(data.stats.totalElevation)} m`} sub="Überwundene Steigung" />
          <StatCard label="Aktivitäten" value={`${data.stats.activityCount} Workouts`} sub="Läufe, Fahrten & mehr" />
        </View>
        {actionMessage ? <Text style={styles.statusMessage}>{actionMessage}</Text> : null}
        {tab === 'Aktivitäten' ? <View style={styles.section}>
          <View style={styles.spaceBetween}><Text style={styles.cardTitle}>Aktivitäten</Text><Text style={styles.small}>{data.pagination.filteredCount} insgesamt</Text></View>
          <View style={styles.inlineRow}>{[['all', `Alle (${data.stats.activityCount})`], ['run', 'Laufen'], ['ride', 'Rennrad']].map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: sport === value }} style={[styles.filter, sport === value && styles.filterActive]} onPress={() => setSport(value)}><Text style={[styles.filterText, sport === value && styles.filterTextActive]}>{label}</Text></Pressable>)}</View>
          {data.activities.length ? data.activities.map(activity => <Pressable key={activity.id} style={styles.activityCard} onPress={() => void toggleActivity(activity)}>
            <View style={styles.spaceBetween}><Text style={styles.activityName} numberOfLines={1}>{activity.name}</Text><Text style={styles.orange}>{formatDistance(activity.distance)}</Text></View>
            <Text style={styles.small}>{activity.sportType.toUpperCase()} · {new Date(activity.startDate).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
            <View style={styles.spaceBetween}><Text style={styles.small}>{formatDuration(activity.movingTime)} · {formatPace(activity.averageSpeed, activity.sportType)}</Text><Text style={styles.small}>+{Math.round(activity.totalElevationGain)} m</Text></View>
            {activity.manualDistance !== null ? <Text style={styles.tiny}>Manuell korrigiert</Text> : null}
            {activity.averageHeartrate ? <Text style={styles.small}>Ø Puls {Math.round(activity.averageHeartrate)} bpm</Text> : null}
            {expandedActivity === activity.stravaId ? <View style={styles.detailBlock}>
              {activityDetail[activity.stravaId] ? <><Text style={styles.copy}>{String(activityDetail[activity.stravaId].description || 'Aktivitätsdetails')}</Text><Text style={styles.copy}>Zeit: {formatDuration(Number(activityDetail[activity.stravaId].elapsedTime ?? activity.movingTime))} · Höhenmeter: {Math.round(Number(activityDetail[activity.stravaId].totalElevationGain ?? activity.totalElevationGain))} m</Text></> : <ActivityIndicator color="#fc7a3d" />}
            </View> : null}
          </Pressable>) : <Text style={styles.copy}>Noch keine Aktivitäten für diesen Filter.</Text>}
          {data.pagination.page < data.pagination.pageCount ? <Pressable style={styles.secondaryButton} onPress={() => void loadMore()}><Text style={styles.secondaryButtonText}>Weitere Aktivitäten laden</Text></Pressable> : null}
        </View> : null}
        {tab !== 'Aktivitäten' ? <View style={styles.section}>
          <View style={styles.spaceBetween}><Text style={styles.cardTitle}>{tab}</Text>{sectionLoading ? <ActivityIndicator color="#fc7a3d" /> : null}</View>
          {data.isReadOnly && ['Physiologie', 'Coach', 'Hinweise'].includes(tab) ? <Text style={styles.copy}>Dieser Bereich ist nur für dein eigenes Profil verfügbar.</Text> : <>
            {tab === 'Trophäen' && !data.isReadOnly ? <View style={styles.weekCard}>
              <Text style={styles.cardTitle}>🎯 Wochenziel</Text><Text style={styles.copy}>Diese Woche: {data.arena.weeklyGoal.activeDays} aktive {data.arena.weeklyGoal.activeDays === 1 ? 'Tag' : 'Tage'}{data.arena.weeklyGoal.targetActiveDays ? ` von ${data.arena.weeklyGoal.targetActiveDays}` : ''}. Nächste Woche legst du dein Ziel fest.</Text>
              <View style={styles.inlineRow}>{[1, 2, 3, 4, 5, 6, 7].map(day => <Pressable key={day} accessibilityRole="button" accessibilityState={{ selected: goalDays === day }} style={[styles.dayOption, goalDays === day && styles.dayOptionActive]} onPress={() => setGoalDays(day)}><Text style={styles.dayText}>{day}</Text></Pressable>)}</View>
              <Pressable style={styles.primaryButton} onPress={() => void saveGoal()} disabled={sectionLoading}><Text style={styles.primaryButtonText}>Ziel für nächste Woche speichern</Text></Pressable>
            </View> : null}
            {sectionData ? <SectionContent tab={tab} sectionData={sectionData} weight={weight} setWeight={setWeight} restingHr={restingHr} setRestingHr={setRestingHr} goalType={goalType} setGoalType={setGoalType} addMetric={() => void addMetric()} requestPlan={() => void requestPlan()} saveCoachProfile={values => void saveCoachProfile(values)} markNotification={(id) => void markNotification(id)} /> : !sectionLoading ? <Text style={styles.copy}>{actionMessage ?? 'Keine Daten vorhanden.'}</Text> : null}
          </>}
        </View> : null}
      </> : null}
    </ScrollView>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <View style={styles.statCard}><Text style={styles.small}>{label}</Text><Text style={styles.statValue}>{value}</Text><Text style={styles.tiny}>{sub}</Text></View>;
}

function SectionContent({ tab, sectionData, weight, setWeight, restingHr, setRestingHr, goalType, setGoalType, addMetric, requestPlan, saveCoachProfile, markNotification }: {
  tab: DashboardTab; sectionData: Record<string, unknown>; weight: string; setWeight: (v: string) => void;
  restingHr: string; setRestingHr: (v: string) => void; goalType: string; setGoalType: (v: string) => void;
  addMetric: () => void; requestPlan: () => void;
  saveCoachProfile: (values: { weeklyAvailability: number; preferredTerrain: string; includeSundayRun: boolean }) => void;
  markNotification: (id?: string) => void;
}) {
  const profile = sectionData.profile as Record<string, unknown> | null;
  const [availability, setAvailability] = useState(Number(profile?.weeklyAvailability ?? 3));
  const [terrain, setTerrain] = useState(String(profile?.preferredTerrain ?? 'ROAD'));
  const [includeSundayRun, setIncludeSundayRun] = useState(Boolean(profile?.includeSundayRun ?? true));
  if (tab === 'Physiologie') {
    const metrics = (sectionData.metrics ?? []) as DashboardData['physiology']['recentMetrics'];
    const profile = sectionData.profile as Record<string, unknown> | null;
      const zones = sectionData.zones as Array<{ name?: string; minHr?: number; maxHr?: number }> | undefined;
    return <View style={styles.stack}>
      <Text style={styles.copy}>VO₂max: {String((sectionData.vo2max as { value?: number } | undefined)?.value ?? 'noch nicht berechnet')} · VDOT: {String(sectionData.calculatedVdot ?? profile?.vdotScore ?? '–')}</Text>
      <Text style={styles.copy}>Maximalpuls: {String(sectionData.calculatedMaxHr ?? profile?.maxHeartrate ?? '–')} bpm · Ruhepuls: {String(profile?.restingHeartrate ?? '–')} bpm</Text>
      {zones?.length ? <View>{zones.map((zone, index) => <Text key={index} style={styles.small}>{zone.name ?? `Zone ${index + 1}`}: {zone.minHr ?? '–'}–{zone.maxHr ?? '–'} bpm</Text>)}</View> : null}
      <Text style={styles.subheading}>Messwerte eintragen</Text>
      <View style={styles.inlineRow}><TextInput style={styles.input} value={weight} onChangeText={setWeight} placeholder="Gewicht kg" placeholderTextColor="#71717a" keyboardType="decimal-pad" /><TextInput style={styles.input} value={restingHr} onChangeText={setRestingHr} placeholder="Ruhepuls bpm" placeholderTextColor="#71717a" keyboardType="number-pad" /></View>
      <Pressable style={styles.primaryButton} onPress={addMetric}><Text style={styles.primaryButtonText}>Messwert speichern</Text></Pressable>
      <Text style={styles.subheading}>Letzte Einträge</Text>
      {metrics.length ? metrics.map(metric => <Text key={metric.id} style={styles.small}>{new Date(metric.date).toLocaleDateString('de-DE')}: {metric.weightKg ? `${metric.weightKg} kg` : ''}{metric.weightKg && metric.restingHeartrate ? ' · ' : ''}{metric.restingHeartrate ? `${metric.restingHeartrate} bpm Ruhepuls` : ''}</Text>) : <Text style={styles.copy}>Noch keine Physiologie-Messwerte.</Text>}
    </View>;
  }
  if (tab === 'Coach') {
    const plan = sectionData.plan as (DashboardData['coach']['activePlan'] & { weeks?: Array<{ id: string; weekNumber: number; phase: string; focusTitle: string | null; workouts: Array<{ id: string; title: string; description: string; scheduledDate: string; status: string; targetDistance: number | null; targetDurationMinutes: number | null }> }> }) | null;
    return <View style={styles.stack}>
      {plan ? <><Text style={styles.subheading}>{plan.title}</Text><Text style={styles.copy}>Woche {plan.currentWeek} von {plan.totalWeeks} · Ende {new Date(plan.endDate).toLocaleDateString('de-DE')}</Text></> : <Text style={styles.copy}>Du hast aktuell keinen aktiven Trainingsplan.</Text>}
      {plan?.weeks?.map(week => <View key={week.id} style={styles.planWeek}><Text style={styles.subheading}>Woche {week.weekNumber} · {week.focusTitle ?? week.phase}</Text>{week.workouts.map(workout => <View key={workout.id} style={styles.workout}><Text style={styles.activityName}>{new Date(workout.scheduledDate).toLocaleDateString('de-DE')} · {workout.title}</Text><Text style={styles.small}>{workout.description}</Text><Text style={styles.tiny}>{workout.targetDistance ? `${workout.targetDistance} km` : ''}{workout.targetDistance && workout.targetDurationMinutes ? ' · ' : ''}{workout.targetDurationMinutes ? `${workout.targetDurationMinutes} min` : ''} · {workout.status}</Text></View>)}</View>)}
      {sectionData.generation ? <Text style={styles.small}>Planstatus: {String((sectionData.generation as { status?: string }).status)}</Text> : null}
      {!plan && <><Text style={styles.subheading}>Neuen Plan anfordern</Text><View style={styles.inlineRow}>{[['GENERAL_FITNESS', 'Allgemein'], ['5K', '5 km'], ['10K', '10 km'], ['HALF_MARATHON', 'Halbmarathon'], ['MARATHON', 'Marathon']].map(([value, label]) => <Pressable key={value} style={[styles.filter, goalType === value && styles.filterActive]} onPress={() => setGoalType(value)}><Text style={[styles.filterText, goalType === value && styles.filterTextActive]}>{label}</Text></Pressable>)}</View><Pressable style={styles.primaryButton} onPress={requestPlan}><Text style={styles.primaryButtonText}>Trainingsplan generieren</Text></Pressable></>}
      <Text style={styles.subheading}>Dein Trainingsprofil</Text>
      <Text style={styles.copy}>Verfügbarkeit: {String(profile?.weeklyAvailability ?? '–')} Tage/Woche · Terrain: {String(profile?.preferredTerrain ?? '–')}</Text>
      <Text style={styles.copy}>VDOT: {String(sectionData.calculatedVdot ?? '–')} · VO₂max: {String((sectionData.vo2max as { value?: number } | undefined)?.value ?? '–')}</Text>
      <Text style={styles.subheading}>Profil anpassen</Text>
      <View style={styles.inlineRow}>{[2, 3, 4, 5, 6].map(value => <Pressable key={value} style={[styles.dayOption, availability === value && styles.dayOptionActive]} onPress={() => setAvailability(value)}><Text style={styles.dayText}>{value}</Text></Pressable>)}</View>
      <View style={styles.inlineRow}>{[['ROAD', 'Straße'], ['TRAIL', 'Trail'], ['MIXED', 'Gemischt']].map(([value, label]) => <Pressable key={value} style={[styles.filter, terrain === value && styles.filterActive]} onPress={() => setTerrain(value)}><Text style={[styles.filterText, terrain === value && styles.filterTextActive]}>{label}</Text></Pressable>)}</View>
      <Pressable style={styles.secondaryButton} onPress={() => setIncludeSundayRun(value => !value)}><Text style={styles.secondaryButtonText}>{includeSundayRun ? '✓' : '○'} Sonntagsrunde einplanen</Text></Pressable>
      <Pressable style={styles.primaryButton} onPress={() => saveCoachProfile({ weeklyAvailability: availability, preferredTerrain: terrain, includeSundayRun })}><Text style={styles.primaryButtonText}>Trainingsprofil speichern</Text></Pressable>
    </View>;
  }
  if (tab === 'Trophäen') {
    const badges = (sectionData.badges ?? []) as Array<{ code: string; name: string; description: string; icon: string; isUnlocked: boolean; level: number }>;
    const stats = sectionData.stats as { unlockedCount?: number; totalCount?: number } | undefined;
    return <View style={styles.stack}>
      <Text style={styles.copy}>{stats?.unlockedCount ?? 0} von {stats?.totalCount ?? badges.length} Trophäen freigeschaltet</Text>
      {badges.map(badge => <View key={badge.code} style={[styles.badgeRow, !badge.isUnlocked && styles.badgeLocked]}><Text style={styles.badgeIcon}>{badge.icon}</Text><View style={{ flex: 1 }}><Text style={styles.activityName}>{badge.name}{badge.level > 1 ? ` · Stufe ${badge.level}` : ''}</Text><Text style={styles.small}>{badge.description}</Text></View><Text style={styles.orange}>{badge.isUnlocked ? '✓' : '·'}</Text></View>)}
    </View>;
  }
  const notifications = (sectionData.notifications ?? []) as Array<{ id: string; title: string; message: string; createdAt: string; isRead: boolean }>;
  return <View style={styles.stack}>
    {notifications.some(item => !item.isRead) ? <Pressable onPress={() => markNotification()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Alle als gelesen markieren</Text></Pressable> : null}
    {notifications.length ? notifications.map(item => <Pressable key={item.id} style={[styles.notification, !item.isRead && styles.notificationUnread]} onPress={() => !item.isRead && markNotification(item.id)}>
      <View style={styles.spaceBetween}><Text style={styles.activityName}>{item.title}</Text><Text style={styles.tiny}>{new Date(item.createdAt).toLocaleDateString('de-DE')}</Text></View><Text style={styles.copy}>{item.message}</Text>{!item.isRead ? <Text style={styles.orange}>Antippen, um als gelesen zu markieren</Text> : null}
    </Pressable>) : <Text style={styles.copy}>Du hast keine Benachrichtigungen.</Text>}
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#09090b' }, content: { padding: 16, gap: 18, paddingBottom: 44 },
  small: { color: '#a1a1aa', fontSize: 12, lineHeight: 18 }, tiny: { color: '#71717a', fontSize: 10 }, logout: { color: '#fb7185', fontSize: 12, fontWeight: '700', padding: 8 },
  memberPanel: { ...panel, padding: 14, gap: 12, backgroundColor: '#18181b' }, memberHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, memberHeadingText: { color: '#d4d4d8', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }, memberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, memberChip: { flexBasis: '48%', flexGrow: 1, minWidth: 140, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: '#27272a', paddingHorizontal: 10, backgroundColor: '#09090b' }, memberChipActive: { borderColor: '#fc7a3d', backgroundColor: '#fc5200' }, memberText: { color: '#e4e4e7', fontSize: 12, fontWeight: '700', flex: 1 }, youBadge: { color: '#fff', fontSize: 10, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, backgroundColor: '#00000033' }, avatar: { width: 24, height: 24, borderRadius: 12 }, avatarPlaceholder: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#3f3f46', alignItems: 'center', justifyContent: 'center' }, avatarLetter: { color: '#fafafa', fontWeight: '800' },
  profileCard: { ...panel, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 24, backgroundColor: '#18181b' }, profileAvatar: { width: 60, height: 60, borderRadius: 17, borderWidth: 2, borderColor: '#fc7a3d' }, profileAvatarPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090b' }, profileInitial: { color: '#fb923c', fontSize: 26, fontWeight: '900' }, profileInfo: { flex: 1, gap: 4, minWidth: 0 }, profileMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }, verified: { color: '#fb923c', fontSize: 9, fontWeight: '900', letterSpacing: 0.5, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#7c2d1233', borderRadius: 10, overflow: 'hidden' }, city: { color: '#a1a1aa', fontSize: 11 }, profileName: { color: '#fafafa', fontSize: 24, fontWeight: '900' }, athleteId: { color: '#a1a1aa', fontSize: 11 }, stravaLink: { color: '#fb923c', fontSize: 11, fontWeight: '800', marginTop: 2 },
  tabGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#27272a' }, tab: { width: '48%', flexGrow: 0, flexShrink: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 15, backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a' }, tabActive: { backgroundColor: '#fc5200', borderColor: '#fc5200' }, tabIcon: { color: '#fb923c', fontSize: 15, fontWeight: '900' }, tabText: { color: '#a1a1aa', fontSize: 11, fontWeight: '800', flexShrink: 1 }, tabTextActive: { color: '#fff' }, tabBadge: { color: '#e4e4e7', fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: '#00000033', overflow: 'hidden' }, tabBadgeOrange: { backgroundColor: '#ea580c', color: '#fff' }, tabBadgeRed: { color: '#fff', fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: '#e11d48', overflow: 'hidden' },
  notificationBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#7c2d12', backgroundColor: '#1c120d' }, notificationBell: { color: '#fb923c', fontSize: 22 }, notificationCopy: { flex: 1, minWidth: 0, gap: 3 }, notificationTitle: { color: '#fb923c', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }, notificationButton: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, backgroundColor: '#fc5200' }, notificationButtonText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, statCard: { ...panel, width: '48%', flexGrow: 1, padding: 16, gap: 3, borderRadius: 17, backgroundColor: '#121214' }, statValue: { color: '#fafafa', fontSize: 20, fontWeight: '900' },
  weekCard: { ...panel, gap: 10, borderColor: '#7c2d12' }, cardTitle: { color: '#fafafa', fontSize: 17, fontWeight: '800' }, copy: { color: '#a1a1aa', fontSize: 13, lineHeight: 19 }, orange: { color: '#fc7a3d', fontSize: 12, fontWeight: '800' },
  inlineRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 }, spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, dayOption: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3f3f46' }, dayOptionActive: { backgroundColor: '#ea580c', borderColor: '#fb923c' }, dayText: { color: '#fafafa', fontWeight: '800' }, primaryButton: { padding: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#ea580c' }, primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  section: { ...panel, gap: 13 }, stack: { gap: 12 }, planWeek: { borderTopWidth: 1, borderTopColor: '#3f3f46', paddingTop: 10, gap: 8 }, workout: { backgroundColor: '#09090b', borderRadius: 10, padding: 10, gap: 4 },
  filter: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 18, backgroundColor: '#27272a' }, filterActive: { backgroundColor: '#ea580c' }, filterText: { color: '#a1a1aa', fontSize: 12, fontWeight: '700' }, filterTextActive: { color: '#fff' }, activityCard: { padding: 14, borderWidth: 1, borderColor: '#27272a', borderRadius: 16, backgroundColor: '#121214', gap: 6 }, activityName: { flex: 1, color: '#f4f4f5', fontSize: 13, fontWeight: '800' }, detailBlock: { marginTop: 8, padding: 12, gap: 6, borderRadius: 12, backgroundColor: '#09090b' }, secondaryButton: { borderRadius: 12, borderWidth: 1, borderColor: '#3f3f46', padding: 11, alignItems: 'center' }, secondaryButtonText: { color: '#e4e4e7', fontSize: 12, fontWeight: '800' },
  subheading: { color: '#e4e4e7', fontWeight: '800', fontSize: 14, marginTop: 5 }, input: { flex: 1, minWidth: 120, color: '#fafafa', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 10, padding: 11, fontSize: 13 }, badgeRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#27272a' }, badgeLocked: { opacity: 0.55 }, badgeIcon: { fontSize: 23 }, notification: { padding: 12, borderRadius: 12, backgroundColor: '#09090b', gap: 6 }, notificationUnread: { borderWidth: 1, borderColor: '#7c2d12' }, statusMessage: { color: '#fdba74', fontSize: 12 }, errorBox: { ...panel, gap: 8 }, errorText: { color: '#fca5a5' }, actionLink: { color: '#fb923c', fontWeight: '800' }, footer: { color: '#52525b', fontSize: 10, textAlign: 'center' },
});
