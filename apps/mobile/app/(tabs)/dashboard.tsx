import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { ActivityDetail } from '../../src/components/ActivityDetail';
import { HealthDataPanel } from '../../src/components/HealthDataPanel';
import { HealthOverviewPanel, type HealthOverviewData } from '../../src/components/HealthOverviewPanel';

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
    if (tab === 'Aktivitäten' || !data || data.isReadOnly && ['Physiologie', 'Coach', 'Hinweise'].includes(tab)) {
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

  async function savePhysiologyProfile(values: { vdotScore: number | null; maxHeartrate: number | null }) {
    setSectionLoading(true); setActionMessage(null);
    try {
      await responseJson(await apiFetch('/api/coach/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }));
      const profile = await responseJson<Record<string, unknown>>(await apiFetch('/api/coach/profile'));
      setSectionData(current => ({ ...(current ?? {}), ...profile }));
      setActionMessage('Leistungsdaten und Pulszonen aktualisiert.');
    } catch (saveError) { setActionMessage(saveError instanceof Error ? saveError.message : 'Leistungsdaten konnten nicht gespeichert werden.'); }
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

  async function refreshTrophies() {
    setSectionLoading(true); setActionMessage(null);
    try {
      await responseJson(await apiFetch('/api/trophies/evaluate', { method: 'POST' }));
      const trophies = await responseJson<Record<string, unknown>>(await apiFetch('/api/trophies'));
      setSectionData(trophies);
      setActionMessage('Erfolge neu abgeglichen.');
    } catch (refreshError) { setActionMessage(refreshError instanceof Error ? refreshError.message : 'Trophäen konnten nicht abgeglichen werden.'); }
    finally { setSectionLoading(false); }
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
        {tab === 'Aktivitäten' ? <View style={styles.statsGrid}>
          <StatCard label="Gesamtdistanz" value={`${data.stats.totalDistanceKm.toFixed(1)} km`} sub="In der Datenbank synchronisiert" />
          <StatCard label="Bewegungszeit" value={`${data.stats.totalHours.toFixed(1)} Std`} sub="Aktiv auf der Strecke" />
          <StatCard label="Höhenmeter" value={`${Math.round(data.stats.totalElevation)} m`} sub="Überwundene Steigung" />
          <StatCard label="Aktivitäten" value={`${data.stats.activityCount} Workouts`} sub="Läufe, Fahrten & mehr" />
        </View> : null}
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
              {activityDetail[activity.stravaId] ? <ActivityDetail detail={activityDetail[activity.stravaId]} /> : <ActivityIndicator color="#fc7a3d" />}
            </View> : null}
          </Pressable>) : <Text style={styles.copy}>Noch keine Aktivitäten für diesen Filter.</Text>}
          {data.pagination.page < data.pagination.pageCount ? <Pressable style={styles.secondaryButton} onPress={() => void loadMore()}><Text style={styles.secondaryButtonText}>Weitere Aktivitäten laden</Text></Pressable> : null}
        </View> : null}
        {tab !== 'Aktivitäten' ? <View style={styles.section}>
          <View style={styles.spaceBetween}><Text style={styles.cardTitle}>{tab}</Text>{sectionLoading ? <ActivityIndicator color="#fc7a3d" /> : null}</View>
          {data.isReadOnly && ['Physiologie', 'Coach', 'Hinweise'].includes(tab) ? <Text style={styles.copy}>Dieser Bereich ist nur für dein eigenes Profil verfügbar.</Text> : <>
            {tab === 'Trophäen' && !data.isReadOnly ? <View style={styles.weekCard}>
              <Text style={styles.cardTitle}>🎯 Vorgenommen. Durchgezogen.</Text><Text style={styles.copy}>Deine Woche. Dein Ziel. Wie oft willst du raus?</Text><Text style={styles.copy}>{data.arena.weeklyGoal.targetActiveDays ? `Diese Woche: ${data.arena.weeklyGoal.activeDays} von ${data.arena.weeklyGoal.targetActiveDays} aktiven Tagen geschafft.` : 'Diese Woche zählt jeder aktive Tag. Dein eigenes Ziel startet nächste Woche.'}</Text><Text style={styles.small}>Ab {data.arena.weeklyGoal.nextWeekKey.split('-').reverse().join('.')}:</Text>
              <View style={styles.inlineRow}>{[1, 2, 3, 4, 5, 6, 7].map(day => <Pressable key={day} accessibilityRole="button" accessibilityState={{ selected: goalDays === day }} style={[styles.dayOption, goalDays === day && styles.dayOptionActive]} onPress={() => setGoalDays(day)}><Text style={styles.dayText}>{day}</Text></Pressable>)}</View>
              <Pressable style={styles.primaryButton} onPress={() => void saveGoal()} disabled={sectionLoading}><Text style={styles.primaryButtonText}>{sectionLoading ? 'Speichert …' : 'Ziel festmachen'}</Text></Pressable><Text style={styles.tiny}>Bis Montag kannst du’s ändern. Danach steht’s. Ruhetage gehören dazu.</Text>
            </View> : null}
            {sectionData ? <SectionContent tab={tab} sectionData={sectionData} arena={data.arena} isReadOnly={data.isReadOnly} sectionLoading={sectionLoading} goalDays={goalDays} setGoalDays={setGoalDays} weight={weight} setWeight={setWeight} restingHr={restingHr} setRestingHr={setRestingHr} goalType={goalType} setGoalType={setGoalType} addMetric={() => void addMetric()} requestPlan={() => void requestPlan()} refreshTrophies={() => void refreshTrophies()} savePhysiologyProfile={values => void savePhysiologyProfile(values)} saveCoachProfile={values => void saveCoachProfile(values)} markNotification={(id) => void markNotification(id)} /> : !sectionLoading ? <Text style={styles.copy}>{actionMessage ?? 'Keine Daten vorhanden.'}</Text> : null}
          </>}
        </View> : null}
      </> : null}
    </ScrollView>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <View style={styles.statCard}><Text style={styles.small}>{label}</Text><Text style={styles.statValue}>{value}</Text><Text style={styles.tiny}>{sub}</Text></View>;
}

function SectionContent({ tab, sectionData, arena, isReadOnly, sectionLoading, goalDays, setGoalDays, weight, setWeight, restingHr, setRestingHr, goalType, setGoalType, addMetric, requestPlan, refreshTrophies, savePhysiologyProfile, saveCoachProfile, markNotification }: {
  tab: DashboardTab; sectionData: Record<string, unknown>; weight: string; setWeight: (v: string) => void;
  isReadOnly: boolean; sectionLoading: boolean;
  arena: DashboardData['arena']; goalDays: number; setGoalDays: (v: number) => void;
  restingHr: string; setRestingHr: (v: string) => void; goalType: string; setGoalType: (v: string) => void;
  addMetric: () => void; requestPlan: () => void; refreshTrophies: () => void;
  savePhysiologyProfile: (values: { vdotScore: number | null; maxHeartrate: number | null }) => void;
  saveCoachProfile: (values: { weeklyAvailability: number; preferredTerrain: string; includeSundayRun: boolean }) => void;
  markNotification: (id?: string) => void;
}) {
  const profile = sectionData.profile as Record<string, unknown> | null;
  const [vdotInput, setVdotInput] = useState(String(profile?.vdotScore ?? ''));
  const [maxHrInput, setMaxHrInput] = useState(String(profile?.maxHeartrate ?? ''));
  const [availability, setAvailability] = useState(Number(profile?.weeklyAvailability ?? 3));
  const [terrain, setTerrain] = useState(String(profile?.preferredTerrain ?? 'ROAD'));
  const [includeSundayRun, setIncludeSundayRun] = useState(Boolean(profile?.includeSundayRun ?? true));
  const [historyMetric, setHistoryMetric] = useState('vdot');
  const [historyIndex, setHistoryIndex] = useState(25);
  const [trophyFilter, setTrophyFilter] = useState('ALL');
  const [selectedTrophy, setSelectedTrophy] = useState<Record<string, any> | null>(null);
  const [healthConnected, setHealthConnected] = useState(false);
  if (tab === 'Physiologie') {
    const metrics = (sectionData.metrics ?? []) as DashboardData['physiology']['recentMetrics'];
    const profile = sectionData.profile as Record<string, unknown> | null;
    const baseline = sectionData.baseline as Record<string, any> | undefined;
    const vo2 = sectionData.vo2max as Record<string, any> | undefined;
    const paces = sectionData.paces as Record<string, string> | undefined;
    const zones = sectionData.zones as Array<{ zone?: number; name?: string; description?: string; minHr?: number; maxHr?: number }> | undefined;
    const history = sectionData.history as Array<Record<string, any>> | undefined;
    const allHistoryOptions = [['vdot', 'VDOT'], ['vo2max', 'VO₂max'], ['paces', 'Trainingspaces'], ['zones', 'Pulszonen'], ['volume', 'Wochenumfang'], ['weight', 'Gewicht'], ['restingHr', 'Ruhepuls'], ['acwr', 'ACWR']];
    const visibleHistoryOptions = allHistoryOptions.filter(([key]) => (history ?? []).some(point => {
      const value = key === 'vdot' ? point.vdot : key === 'vo2max' ? point.vo2max?.value : key === 'paces' ? point.paces?.easyMin : key === 'zones' ? point.zones?.[4]?.maxHr : key === 'volume' ? point.baseline?.averageWeeklyKm : key === 'weight' ? point.weightKg : key === 'restingHr' ? point.restingHeartrate : point.baseline?.acwr;
      return value != null && Number.isFinite(Number(value));
    }));
    const effectiveHistoryMetric = visibleHistoryOptions.some(([key]) => key === historyMetric) ? historyMetric : String(visibleHistoryOptions[0]?.[0] ?? historyMetric);
    const displayedHistoryValue = (point: Record<string, any>) => effectiveHistoryMetric === 'vdot' ? point.vdot : effectiveHistoryMetric === 'vo2max' ? point.vo2max?.value : effectiveHistoryMetric === 'paces' ? point.paces?.easyMin : effectiveHistoryMetric === 'zones' ? point.zones?.[4]?.maxHr : effectiveHistoryMetric === 'volume' ? point.baseline?.averageWeeklyKm : effectiveHistoryMetric === 'weight' ? point.weightKg : effectiveHistoryMetric === 'restingHr' ? point.restingHeartrate : point.baseline?.acwr;
    const visibleHistoryValues = (history ?? []).map(displayedHistoryValue).map(value => value == null ? null : Number(value));
    const visibleFiniteHistoryValues = visibleHistoryValues.filter((value): value is number => value !== null && Number.isFinite(value));
    const visibleHistoryMin = Math.min(...visibleFiniteHistoryValues, 0);
    const visibleHistoryMax = Math.max(...visibleFiniteHistoryValues, 1);
    const activeHistory = history?.[Math.min(historyIndex, Math.max(0, (history?.length ?? 1) - 1))];
    const metricCard = { width: '47%' as const, flexGrow: 1 as const, backgroundColor: '#18181b', borderColor: '#27272a', borderWidth: 1, borderRadius: 14, padding: 13, gap: 4 };
    const metricLabel = { color: '#a1a1aa', fontSize: 10, fontWeight: '800' as const, textTransform: 'uppercase' as const };
    return <View style={styles.stack}>
      <Text style={styles.copy}>Deine Leistungswerte, Gesundheitsmetriken und individuellen Trainingsbereiche.</Text>
      {!healthConnected ? <HealthDataPanel initialConnected={healthConnected} onConnectionChange={setHealthConnected} /> : null}
      {sectionData.healthOverview ? <HealthOverviewPanel data={sectionData.healthOverview as HealthOverviewData} /> : null}
      <View style={styles.inlineRow}>
        {[
          ['VDOT Fitnesswert', String(sectionData.calculatedVdot ?? '–'), profile?.vdotScore != null ? `Manuell · automatisch ${baseline?.estimatedVdot ?? '–'}` : 'Automatisch aus Strava- und vollständigen Health-Läufen'],
          ['Maximalpuls (HRmax)', `${sectionData.calculatedMaxHr ?? '–'} bpm`, profile?.maxHeartrate != null ? 'Manuelle Vorgabe' : baseline?.measuredMaxHr != null ? 'Höchster Puls aus Strava-/Health-Läufen · 12 Wochen' : 'Standard-Schätzung'],
          ['Wochen-Ø Volumen', `${baseline?.averageWeeklyKm ?? '–'} km`, 'Basis der letzten 8 Wochen'],
          ['ACWR Belastungsverhältnis', String(baseline?.acwr ?? '–'), 'Laufumfang letzte 7 Tage vs. 4-Wochenmittel'],
        ].map(([label, value, hint]) => <View key={label} style={metricCard}><Text style={metricLabel}>{label}</Text><Text style={{ color: '#f4f4f5', fontSize: 22, fontWeight: '900' }}>{value}</Text><Text style={styles.tiny}>{hint}</Text></View>)}
      </View>
      {vo2?.value != null ? <View style={styles.weekCard}><Text style={styles.subheading}>VO₂max · Schätzung</Text><Text style={{ color: '#22d3ee', fontSize: 32, fontWeight: '900' }}>{vo2.value} <Text style={{ fontSize: 13, color: '#a1a1aa' }}>ml/kg/min</Text></Text><Text style={styles.copy}>Datenqualität: {vo2.quality === 'moderate' ? 'Mittel' : vo2.quality === 'limited' ? 'Begrenzt' : 'Unzureichend'} · {vo2.sampleCount ?? 0} geeignete Läufe / 6 Wochen</Text><Text style={styles.small}>{vo2.reason ?? 'Der Wert wird aus geeigneten Lauf- und Pulsdaten geschätzt.'}</Text><Text style={styles.small}>Verwendeter Maximalpuls: {vo2.maxHr ?? sectionData.calculatedMaxHr ?? '–'} bpm · {vo2.method === 'oxygen-reserve' ? 'mit Ruhepuls / Sauerstoffreserve' : 'ohne Ruhepuls / Anteil am Maximalpuls'}</Text>{vo2.latestSampleDate ? <Text style={styles.tiny}>Letzter geeigneter Lauf: {new Date(vo2.latestSampleDate).toLocaleDateString('de-DE')}</Text> : null}<Text style={styles.tiny}>VO₂max ist eine Modellschätzung und keine Messung. Sie verändert weder VDOT noch Trainings-Paces.</Text><View style={[styles.workout, { gap: 6 }]}><Text style={styles.orange}>Wie wird der Wert geschätzt?</Text><Text style={styles.tiny}>Aus Laufgeschwindigkeit wird der Sauerstoffbedarf modelliert und anhand des Pulses auf maximale Belastung hochgerechnet. Neuere Läufe zählen stärker; Ausreißer werden gefiltert.</Text><Text style={styles.tiny}>Berücksichtigt werden geeignete Straßenläufe mit ausreichender Dauer, Distanz und Pulsdaten. Trail- und virtuelle Läufe sowie starke Steigungen werden ausgeschlossen. Hitze, Wind, Medikamente und individuelle Laufökonomie können nicht zuverlässig berücksichtigt werden.</Text></View></View> : null}
      {history?.length && visibleHistoryOptions.length ? <View style={styles.weekCard}><Text style={styles.subheading}>Deine Entwicklung · 26 Wochen</Text><Text style={styles.tiny}>Wähle eine Messreihe und Woche für die historischen Werte.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.inlineRow}>{visibleHistoryOptions.map(([key, label]) => <Pressable key={key} onPress={() => setHistoryMetric(key)} style={[styles.filter, effectiveHistoryMetric === key && styles.filterActive]}><Text style={[styles.filterText, effectiveHistoryMetric === key && styles.filterTextActive]}>{label}</Text></Pressable>)}</View></ScrollView><View style={{ height: 130, flexDirection: 'row', alignItems: 'flex-end', gap: 3, paddingVertical: 8 }}>{visibleHistoryValues.map((value, index) => <Pressable key={index} onPress={() => setHistoryIndex(index)} style={{ flex: 1, height: `${value == null ? 3 : Math.max(5, ((value - visibleHistoryMin) / Math.max(1e-6, visibleHistoryMax - visibleHistoryMin)) * 90)}%`, backgroundColor: index === historyIndex ? '#fb923c' : value == null ? '#27272a' : '#71717a', borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />)}</View>{activeHistory ? <View style={[styles.workout, { gap: 7 }]}><View style={styles.spaceBetween}><Text style={styles.orange}>{visibleHistoryOptions.find(([key]) => key === effectiveHistoryMetric)?.[1]}</Text><Text style={styles.small}>{new Date(activeHistory.date).toLocaleDateString('de-DE')}</Text></View><Text style={styles.activityName}>{displayedHistoryValue(activeHistory) == null ? 'In dieser Woche keine Messung' : `${displayedHistoryValue(activeHistory)} ${effectiveHistoryMetric === 'volume' ? 'km/Woche' : effectiveHistoryMetric === 'weight' ? 'kg' : effectiveHistoryMetric === 'restingHr' || effectiveHistoryMetric === 'zones' ? 'bpm' : effectiveHistoryMetric === 'acwr' ? 'ACWR' : effectiveHistoryMetric === 'paces' ? 'min/km' : ''}`}</Text></View> : null}<View style={styles.spaceBetween}><Pressable disabled={historyIndex <= 0} onPress={() => setHistoryIndex(Math.max(0, historyIndex - 1))}><Text style={[styles.actionLink, historyIndex <= 0 && { opacity: 0.4 }]}>‹ Vorherige Woche</Text></Pressable><Pressable disabled={historyIndex >= history.length - 1} onPress={() => setHistoryIndex(Math.min(history.length - 1, historyIndex + 1))}><Text style={[styles.actionLink, historyIndex >= history.length - 1 && { opacity: 0.4 }]}>Nächste Woche ›</Text></Pressable></View><Text style={styles.tiny}>Historische manuelle VDOT- und Maximalpuls-Vorgaben sind nicht gespeichert; frühere Zonen und Paces sind rekonstruiert.</Text></View> : null}
      <View style={styles.weekCard}><Text style={styles.subheading}>Leistungsniveau & VDOT-Feinabstimmung</Text><Text style={styles.small}>VDOT wird aus Pace, Steigung und verfügbaren Pulsdaten geschätzt. Ein bekannter VDOT oder Maximalpuls kann manuell gesetzt werden.</Text><View style={styles.inlineRow}><TextInput style={styles.input} value={vdotInput} onChangeText={setVdotInput} placeholder="VDOT, z. B. 45" placeholderTextColor="#71717a" keyboardType="decimal-pad" /><TextInput style={styles.input} value={maxHrInput} onChangeText={setMaxHrInput} placeholder="Maximalpuls bpm" placeholderTextColor="#71717a" keyboardType="number-pad" /></View><Pressable style={styles.primaryButton} onPress={() => savePhysiologyProfile({ vdotScore: vdotInput.trim() ? Number(vdotInput.replace(',', '.')) : null, maxHeartrate: maxHrInput.trim() ? Number(maxHrInput) : null })}><Text style={styles.primaryButtonText}>Paces & Zonen aktualisieren</Text></Pressable><Text style={styles.tiny}>Aktuell verwendet: VDOT {String(sectionData.calculatedVdot ?? '–')} · HRmax {String(sectionData.calculatedMaxHr ?? '–')} bpm</Text><View style={styles.inlineRow}>{[['Easy / Grundlage', 'easy'], ['Marathon / zügig', 'marathon'], ['Threshold / Schwelle', 'threshold'], ['Intervall / VO₂max', 'interval']].map(([label, key]) => <View key={key} style={metricCard}><Text style={metricLabel}>{label}</Text><Text style={{ color: '#f4f4f5', fontSize: 16, fontWeight: '800' }}>{paces?.[`${key}Min`] ?? '–'} – {paces?.[`${key}Max`] ?? '–'}</Text><Text style={styles.tiny}>min/km</Text></View>)}</View></View>
      <Pressable onPress={() => { setVdotInput(''); void savePhysiologyProfile({ vdotScore: null, maxHeartrate: null }); }}><Text style={styles.actionLink}>VDOT automatisch ermitteln</Text></Pressable>
      <View style={styles.weekCard}><Text style={styles.subheading}>Deine 5 Herzfrequenz-Zonen</Text><Text style={styles.tiny}>Pulsbereiche für gezielte aerobe und anaerobe Anpassung.</Text>{zones?.map((zone, index) => <View key={zone.zone ?? index} style={[styles.workout, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}><Text style={styles.tabBadge}>Z{zone.zone ?? index + 1}</Text><View style={{ flex: 1 }}><Text style={styles.activityName}>{zone.name}</Text><Text style={styles.tiny}>{zone.description}</Text></View><Text style={styles.small}>{zone.minHr}–{zone.maxHr} bpm</Text></View>)}</View>
      <View style={styles.weekCard}><Text style={styles.subheading}>Körperdaten & Vital-Tracking</Text><Text style={styles.small}>Gewicht und Ruhepuls historisch erfassen. Die Werte fließen in Verlauf und Pulszonen ein.</Text><View style={styles.inlineRow}><TextInput style={styles.input} value={weight} onChangeText={setWeight} placeholder="Gewicht kg" placeholderTextColor="#71717a" keyboardType="decimal-pad" /><TextInput style={styles.input} value={restingHr} onChangeText={setRestingHr} placeholder="Ruhepuls bpm" placeholderTextColor="#71717a" keyboardType="number-pad" /></View><Pressable style={styles.primaryButton} onPress={addMetric}><Text style={styles.primaryButtonText}>Messwert speichern</Text></Pressable><Text style={styles.tiny}>Ruhepuls aktuell: {String(sectionData.calculatedRestingHeartrate ?? '–')} bpm · Maximalpuls: {String(sectionData.calculatedMaxHr ?? '–')} bpm</Text>
        {metrics.length ? <><View style={styles.inlineRow}>{[['NEUESTES GEWICHT', metrics.find(metric => metric.weightKg != null)?.weightKg ? `${metrics.find(metric => metric.weightKg != null)?.weightKg} kg` : '–'], ['NEUESTER RUHEPULS', metrics.find(metric => metric.restingHeartrate != null)?.restingHeartrate ? `${metrics.find(metric => metric.restingHeartrate != null)?.restingHeartrate} bpm` : '–'], ['ERFASSTE EINTRÄGE', String(metrics.length)]].map(([label, value]) => <View key={label} style={metricCard}><Text style={metricLabel}>{label}</Text><Text style={{ color: '#f4f4f5', fontSize: 18, fontWeight: '900' }}>{value}</Text></View>)}</View><Text style={styles.subheading}>Messhistorie · {metrics.length} Einträge</Text>{metrics.slice(0, 15).map(metric => <View key={metric.id} style={styles.spaceBetween}><Text style={styles.small}>{new Date(metric.date).toLocaleDateString('de-DE')}</Text><Text style={styles.small}>{metric.weightKg ? `${metric.weightKg} kg` : '–'} · {metric.restingHeartrate ? `${metric.restingHeartrate} bpm` : '–'}{metric.notes ? ` · ${metric.notes}` : ''}</Text></View>)}</> : <Text style={styles.small}>Noch keine manuellen Messwerte eingetragen.</Text>}</View>
      {healthConnected ? <HealthDataPanel initialConnected={healthConnected} onConnectionChange={setHealthConnected} /> : null}
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
    const badges = (sectionData.badges ?? []) as Array<Record<string, any>>;
    const stats = sectionData.stats as { unlockedCount?: number; totalCount?: number; weeklyCrownsCount?: number; monthlyAwardsCount?: number } | undefined;
    const unlocked = badges.filter(badge => badge.isUnlocked).length;
    const weeklyTitles = ['WEEKLY_RUN_DISTANCE', 'WEEKLY_RIDE_DISTANCE', 'WEEKLY_STAYED_ACTIVE', 'WEEKLY_ROUTINE', 'WEEKLY_GOAL', 'WEEKLY_PROGRESS'];
    const filteredBadges = badges.filter(badge => trophyFilter === 'ALL' || trophyFilter === 'UNLOCKED' && badge.isUnlocked || trophyFilter === 'LOCKED' && !badge.isUnlocked || trophyFilter === 'WEEKLY' && badge.category === 'WEEKLY' || trophyFilter === 'MONTHLY' && badge.category === 'MONTHLY' || trophyFilter === 'DISTANCE' && badge.category === 'DISTANCE' || trophyFilter === 'COMMUNITY' && ['COMMUNITY', 'STREAK'].includes(badge.category));
    return <View style={styles.stack}>
      <View style={styles.weekCard}><View style={{ gap: 8 }}><Text style={styles.orange}>🏆 DORFDÜSEN VITRINE & TROPHÄENSCHRANK</Text><Text style={styles.cardTitle}>Deine Erfolge & Trophäen</Text></View><Text style={styles.copy}>Hier stehen deine errungenen Wochentitel, Monatskronen und persönlichen Meilensteine. Jeder Kilometer bringt dich der nächsten Auszeichnung näher.</Text>{!isReadOnly ? <Pressable style={styles.secondaryButton} onPress={refreshTrophies} disabled={sectionLoading}><Text style={styles.secondaryButtonText}>{sectionLoading ? 'Prüfe …' : 'Erfolge neu abgleichen'}</Text></Pressable> : null}<View style={styles.inlineRow}>{[['FREIGESCHALTET', `${unlocked} / ${stats?.totalCount ?? badges.length}`], ['WOCHENKRONEN', `${stats?.weeklyCrownsCount ?? 0} Siege`], ['MONATS-POKALE', `${stats?.monthlyAwardsCount ?? 0} Pokale`], ['CLUB-ABSCHLUSS', `${Math.round(unlocked / Math.max(1, badges.length) * 100)}%`]].map(([label, value]) => <View key={label} style={{ ...styles.statCard, flex: 1, minWidth: '45%' }}><Text style={styles.tiny}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>)}</View></View>
      <View style={styles.weekCard}><Text style={styles.cardTitle}>👑 Die Ehrentafel · Deine Wochen-Erfolge</Text><Text style={styles.small}>Jeden Montag nach Wochenabschluss werden Erfolge ausgezeichnet. Bisherige Trophäen bleiben erhalten. Die Regeln gelten bereits für die laufende Woche.</Text>{badges.filter(badge => weeklyTitles.includes(badge.code)).map(badge => { const leaderCode: Record<string, string> = { WEEKLY_RUN_DISTANCE: 'run_distance', WEEKLY_RIDE_DISTANCE: 'ride_distance', WEEKLY_STAYED_ACTIVE: 'stayed_active', WEEKLY_ROUTINE: 'routine', WEEKLY_GOAL: 'goal', WEEKLY_PROGRESS: 'progress' }; const live = ((sectionData.currentWeekLeaderTitles as string[] | undefined) ?? []).includes(leaderCode[badge.code]); return <Pressable key={badge.code} onPress={() => setSelectedTrophy(badge)} style={[styles.badgeRow, (badge.level > 0 || live) && styles.weeklyBadgeActive]}><Text style={styles.badgeIcon}>{badge.icon}</Text><View style={{ flex: 1 }}><Text style={styles.tiny}>{live ? 'DIESE WOCHE ERREICHT! · ' : ''}WOCHENTITEL {badge.level ? `· ${badge.level}× erreicht` : ''}</Text><Text style={styles.activityName}>{badge.name}</Text><Text style={styles.small}>{badge.description}</Text><Text style={styles.tiny}>{badge.level ? `Zuletzt erreicht: ${badge.metadata?.history?.at(-1)?.weekKey ?? 'Titelhistorie'}` : 'Noch nicht erreicht'}</Text></View></Pressable>; })}</View>
      <View style={styles.inlineRow}>{[['ALL', 'Alle Trophäen', badges.length], ['UNLOCKED', 'Freigeschaltet', unlocked], ['WEEKLY', 'Wochenkronen', badges.filter(b => b.category === 'WEEKLY').length], ['MONTHLY', 'Monatspokale', badges.filter(b => b.category === 'MONTHLY').length], ['DISTANCE', 'Meilensteine', badges.filter(b => b.category === 'DISTANCE').length], ['COMMUNITY', 'Dorfdüsen Kult', badges.filter(b => ['COMMUNITY', 'STREAK'].includes(b.category)).length], ['LOCKED', 'Noch gesperrt', badges.length - unlocked]].map(([key, label, count]) => <Pressable key={key} onPress={() => setTrophyFilter(String(key))} style={[styles.filter, trophyFilter === key && styles.filterActive]}><Text style={[styles.filterText, trophyFilter === key && styles.filterTextActive]}>{label} ({count})</Text></Pressable>)}</View>
      {filteredBadges.map(badge => <Pressable key={badge.code} onPress={() => setSelectedTrophy(badge)} style={[styles.badgeRow, !badge.isUnlocked && styles.badgeLocked]}><Text style={styles.badgeIcon}>{badge.icon}</Text><View style={{ flex: 1 }}><Text style={styles.tiny}>{String(badge.rarity ?? '').toUpperCase()} {badge.level > 1 ? `· Stufe ${badge.level}` : ''}</Text><Text style={styles.activityName}>{badge.name}</Text><Text style={styles.small}>{badge.description}</Text><Text style={styles.tiny}>{badge.isUnlocked ? '✓ Freigeschaltet' : '🔒 Gesperrt'} · Details →</Text></View></Pressable>)}
      <Modal transparent visible={Boolean(selectedTrophy)} animationType="fade" onRequestClose={() => setSelectedTrophy(null)}><View style={styles.modalBackdrop}><View style={styles.trophyModal}><View style={{ alignItems: 'center', gap: 8 }}><Text style={{ fontSize: 46 }}>{selectedTrophy?.icon}</Text><Text style={styles.cardTitle}>{selectedTrophy?.name}</Text><Text style={styles.tiny}>{selectedTrophy?.category} · {selectedTrophy?.rarity}</Text></View><Text style={[styles.copy, { textAlign: 'center', backgroundColor: '#09090b', padding: 13, borderRadius: 12 }]}>{selectedTrophy?.description}</Text>{selectedTrophy?.isUnlocked ? <Text style={styles.statusMessage}>✓ Erfolgreich freigeschaltet{selectedTrophy.unlockedAt ? ` am ${new Date(selectedTrophy.unlockedAt).toLocaleDateString('de-DE')}` : ''}{selectedTrophy.level > 1 ? ` · Stufe ${selectedTrophy.level}` : ''}</Text> : <View style={styles.workout}><Text style={styles.activityName}>Wie schalte ich das frei?</Text><Text style={styles.small}>{selectedTrophy?.hint || selectedTrophy?.description}</Text></View>}{selectedTrophy?.metadata?.activity ? <View style={styles.workout}><Text style={styles.activityName}>Zugrunde liegende Aktivität</Text><Text style={styles.small}>{String(selectedTrophy.metadata.activity.name)} · {String(selectedTrophy.metadata.activity.distanceKm)} km</Text><Pressable onPress={() => { const stravaId = selectedTrophy.metadata.activity.stravaId; if (typeof stravaId === 'string') void Linking.openURL(`https://www.strava.com/activities/${stravaId}`); }}><Text style={styles.actionLink}>Auf Strava ansehen ↗</Text></Pressable></View> : null}{Array.isArray(selectedTrophy?.metadata?.history) ? <View style={{ maxHeight: 120 }}><Text style={styles.activityName}>Historie der Titelgewinne</Text><ScrollView>{(selectedTrophy.metadata.history as Array<Record<string, unknown>>).map((item, index) => <Text key={index} style={styles.tiny}>{String(item.weekKey ?? item.monthKey ?? 'Erfolg')} · {String(item.formattedValue ?? item.distanceKm ?? 'Gewonnen')}</Text>)}</ScrollView></View> : null}<Pressable onPress={() => setSelectedTrophy(null)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Schließen</Text></Pressable></View></View></Modal>
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
  subheading: { color: '#e4e4e7', fontWeight: '800', fontSize: 14, marginTop: 5 }, input: { flex: 1, minWidth: 120, color: '#fafafa', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 10, padding: 11, fontSize: 13 }, badgeRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#27272a' }, badgeLocked: { opacity: 0.55 }, weeklyBadgeActive: { backgroundColor: '#29200f', borderRadius: 12, borderColor: '#78350f', borderWidth: 1, paddingHorizontal: 10 }, badgeIcon: { fontSize: 23 }, modalBackdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', padding: 20 }, trophyModal: { maxHeight: '88%', backgroundColor: '#18181b', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 24, padding: 20, gap: 14 }, notification: { padding: 12, borderRadius: 12, backgroundColor: '#09090b', gap: 6 }, notificationUnread: { borderWidth: 1, borderColor: '#7c2d12' }, statusMessage: { color: '#fdba74', fontSize: 12 }, errorBox: { ...panel, gap: 8 }, errorText: { color: '#fca5a5' }, actionLink: { color: '#fb923c', fontWeight: '800' }, footer: { color: '#52525b', fontSize: 10, textAlign: 'center' },
});
