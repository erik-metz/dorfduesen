import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';

type Activity = {
  id: string; stravaId: string; name: string; sportType: string; distance: number;
  movingTime: number; totalElevationGain: number; startDate: string; averageHeartrate?: number | null;
};
type DashboardData = {
  user: { id: string; firstname: string | null; lastname: string | null; username: string | null; profile: string | null; city?: string | null; activityCount: number; lastSync?: string | null };
  isReadOnly: boolean;
  activities: Activity[];
  stats: { totalDistanceKm: number; totalHours: number; totalElevation: number; activityCount: number };
  pagination: { page: number; pageCount: number; filteredCount: number; sport: string };
  physiology: { recentMetrics: Array<{ id: string; date: string; weightKg: number | null; restingHeartrate: number | null; notes: string | null }> };
  coach: { activePlan: null | { id: string; title: string; status: string; currentWeek: number; totalWeeks: number; endDate: string } };
  notifications: { unreadCount: number };
  arena: { weekKm: number; weekActivitiesCount: number; activeAthletesCount: number; weeklyGoal: { activeDays: number; targetActiveDays: number | null; nextWeekTargetActiveDays: number | null; nextWeekKey: string }; champions: Array<{ id: string; title: string; icon: string; isCurrentLeader: boolean }> };
};
type Member = { id: string; name: string; profile: string | null; city: string | null };
type DashboardTab = 'Aktivitäten' | 'Physiologie' | 'Coach' | 'Trophäen' | 'Hinweise';

const tabs: DashboardTab[] = ['Aktivitäten', 'Physiologie', 'Coach', 'Trophäen', 'Hinweise'];
const panel = { backgroundColor: '#18181b', borderColor: '#27272a', borderWidth: 1, borderRadius: 20, padding: 18 } as const;

async function responseJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Die Daten konnten nicht geladen werden.');
  return data as T;
}
function formatDistance(meters: number) { return `${(meters / 1000).toFixed(1)} km`; }
function formatDuration(seconds: number) { const minutes = Math.round(seconds / 60); return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')} h`; }
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
      if (tab === 'Trophäen') return responseJson<Record<string, unknown>>(await apiFetch('/api/trophies'));
      return responseJson<Record<string, unknown>>(await apiFetch('/api/notifications'));
    };
    void load().then(result => { if (active) setSectionData(result); })
      .catch(loadError => { if (active) setActionMessage(loadError instanceof Error ? loadError.message : 'Bereich konnte nicht geladen werden.'); })
      .finally(() => { if (active) setSectionLoading(false); });
    return () => { active = false; };
  }, [apiFetch, data, tab]);

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
      <View style={styles.topRow}>
        <View><Text style={styles.greeting}>Moin, {titleName}</Text><Text style={styles.small}>{data?.isReadOnly ? 'Mitgliederprofil · schreibgeschützt' : 'Dein Training auf einen Blick'}</Text></View>
        <Pressable accessibilityRole="button" onPress={() => void logout()}><Text style={styles.logout}>Abmelden</Text></Pressable>
      </View>
      {members.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberRow}>
        {members.map(member => <Pressable key={member.id} style={[styles.memberChip, (selectedUserId ?? user?.id) === member.id && styles.memberChipActive]} onPress={() => { setSelectedUserId(member.id === user?.id ? null : member.id); setTab('Aktivitäten'); setSectionData(null); }}>
          {member.profile ? <Image source={{ uri: member.profile }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><Text style={styles.avatarLetter}>{member.name.slice(0, 1)}</Text></View>}
          <Text style={styles.memberText}>{member.id === user?.id ? 'Ich' : member.name}</Text>
        </Pressable>)}
      </ScrollView> : null}

      <Text style={styles.kicker}>DEIN TRAINING</Text>
      <Text style={styles.heading}>Dashboard</Text>
      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void loadDashboard()}><Text style={styles.actionLink}>Erneut versuchen</Text></Pressable></View> : null}
      {loading && !data ? <ActivityIndicator color="#fc7a3d" size="large" style={{ marginTop: 40 }} /> : data ? <>
        {!data.isReadOnly && <View style={styles.statsGrid}>
          <StatCard label="Gesamt" value={formatDistance(data.stats.totalDistanceKm * 1000)} sub={String(data.stats.activityCount) + ' Aktivitäten'} />
          <StatCard label="Bewegungszeit" value={`${data.stats.totalHours.toFixed(1)} h`} sub="gesamt" />
          <StatCard label="Höhenmeter" value={`${Math.round(data.stats.totalElevation)} m`} sub="gesamt" />
          <StatCard label="Diese Woche" value={`${data.arena.weekKm.toFixed(1)} km`} sub={`${data.arena.weekActivitiesCount} Aktivitäten`} />
        </View>}
        {!data.isReadOnly && <View style={styles.weekCard}>
          <Text style={styles.cardTitle}>🎯 Wochenziel</Text>
          <Text style={styles.copy}>Diese Woche: {data.arena.weeklyGoal.activeDays} aktive {data.arena.weeklyGoal.activeDays === 1 ? 'Tag' : 'Tage'}{data.arena.weeklyGoal.targetActiveDays ? ` von ${data.arena.weeklyGoal.targetActiveDays}` : ''}. Nächste Woche legst du dein Ziel fest.</Text>
          <View style={styles.inlineRow}>{[1, 2, 3, 4, 5, 6, 7].map(day => <Pressable key={day} style={[styles.dayOption, goalDays === day && styles.dayOptionActive]} onPress={() => setGoalDays(day)}><Text style={styles.dayText}>{day}</Text></Pressable>)}</View>
          <Pressable style={styles.primaryButton} onPress={() => void saveGoal()} disabled={sectionLoading}><Text style={styles.primaryButtonText}>Ziel für nächste Woche speichern</Text></Pressable>
        </View>}
        {!data.isReadOnly && <View style={styles.arenaCard}>
          <View style={styles.spaceBetween}><Text style={styles.cardTitle}>Düsen-Arena</Text><Text style={styles.orange}>{data.arena.activeAthletesCount} aktiv</Text></View>
          <Text style={styles.copy}>{data.arena.champions.filter(champion => champion.isCurrentLeader).length ? `Du führst bei ${data.arena.champions.filter(champion => champion.isCurrentLeader).map(champion => champion.title).join(', ')}.` : 'Dein Wochenfortschritt in der Arena.'}</Text>
          <Text style={styles.copy}>{data.arena.champions.filter(champion => champion.isCurrentLeader).map(champion => `${champion.icon} ${champion.title}`).join('   ')}</Text>
        </View>}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {tabs.map(item => <Pressable key={item} style={[styles.tab, tab === item && styles.tabActive]} onPress={() => setTab(item)}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}{item === 'Hinweise' && data.notifications.unreadCount > 0 && !data.isReadOnly ? ` ${data.notifications.unreadCount}` : ''}</Text></Pressable>)}
        </ScrollView>
        {actionMessage ? <Text style={styles.statusMessage}>{actionMessage}</Text> : null}
        {tab === 'Aktivitäten' ? <View style={styles.section}>
          <View style={styles.spaceBetween}><Text style={styles.cardTitle}>Aktivitäten</Text><Text style={styles.small}>{data.pagination.filteredCount} insgesamt</Text></View>
          <View style={styles.inlineRow}>{[['all', 'Alle'], ['run', 'Laufen'], ['ride', 'Rad']].map(([value, label]) => <Pressable key={value} style={[styles.filter, sport === value && styles.filterActive]} onPress={() => setSport(value)}><Text style={[styles.filterText, sport === value && styles.filterTextActive]}>{label}</Text></Pressable>)}</View>
          {data.activities.length ? data.activities.map(activity => <Pressable key={activity.id} style={styles.activityCard} onPress={() => void toggleActivity(activity)}>
            <View style={styles.spaceBetween}><Text style={styles.activityName} numberOfLines={1}>{activity.name}</Text><Text style={styles.orange}>{formatDistance(activity.distance)}</Text></View>
            <Text style={styles.small}>{activity.sportType} · {new Date(activity.startDate).toLocaleDateString('de-DE')} · {formatDuration(activity.movingTime)} · {Math.round(activity.totalElevationGain)} hm</Text>
            {activity.averageHeartrate ? <Text style={styles.small}>Ø Puls {Math.round(activity.averageHeartrate)} bpm</Text> : null}
            {expandedActivity === activity.stravaId ? <View style={styles.detailBlock}>
              {activityDetail[activity.stravaId] ? <><Text style={styles.copy}>{String(activityDetail[activity.stravaId].description || 'Aktivitätsdetails')}</Text><Text style={styles.copy}>Zeit: {formatDuration(Number(activityDetail[activity.stravaId].elapsedTime ?? activity.movingTime))} · Höhenmeter: {Math.round(Number(activityDetail[activity.stravaId].totalElevationGain ?? activity.totalElevationGain))} m</Text></> : <ActivityIndicator color="#fc7a3d" />}
            </View> : null}
          </Pressable>) : <Text style={styles.copy}>Noch keine Aktivitäten für diesen Filter.</Text>}
          {data.pagination.page < data.pagination.pageCount ? <Pressable style={styles.secondaryButton} onPress={() => void loadMore()}><Text style={styles.secondaryButtonText}>Weitere Aktivitäten laden</Text></Pressable> : null}
        </View> : null}
        {tab !== 'Aktivitäten' ? <View style={styles.section}>
          <View style={styles.spaceBetween}><Text style={styles.cardTitle}>{tab}</Text>{sectionLoading ? <ActivityIndicator color="#fc7a3d" /> : null}</View>
          {data.isReadOnly ? <Text style={styles.copy}>Dieser Bereich ist nur für dein eigenes Profil verfügbar.</Text> : sectionData ? <SectionContent tab={tab} sectionData={sectionData} weight={weight} setWeight={setWeight} restingHr={restingHr} setRestingHr={setRestingHr} goalType={goalType} setGoalType={setGoalType} addMetric={() => void addMetric()} requestPlan={() => void requestPlan()} saveCoachProfile={values => void saveCoachProfile(values)} markNotification={(id) => void markNotification(id)} /> : !sectionLoading ? <Text style={styles.copy}>{actionMessage ?? 'Keine Daten vorhanden.'}</Text> : null}
        </View> : null}
      </> : null}
      <Text style={styles.footer}>Zuletzt synchronisiert: {data?.user.lastSync ? new Date(data.user.lastSync).toLocaleString('de-DE') : 'noch nicht verfügbar'}</Text>
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
  page: { flex: 1, backgroundColor: '#09090b' }, content: { padding: 20, gap: 16, paddingBottom: 44 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  greeting: { color: '#fafafa', fontSize: 17, fontWeight: '800' }, small: { color: '#a1a1aa', fontSize: 12, lineHeight: 18 }, tiny: { color: '#71717a', fontSize: 10 }, logout: { color: '#a1a1aa', fontSize: 12, fontWeight: '700', padding: 8 },
  kicker: { color: '#fc7a3d', fontWeight: '800', letterSpacing: 1.8, fontSize: 11, marginTop: 4 }, heading: { color: '#fafafa', fontSize: 30, fontWeight: '900', marginTop: -12 },
  memberRow: { gap: 8 }, memberChip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 30, borderWidth: 1, borderColor: '#27272a', padding: 6, paddingRight: 12, backgroundColor: '#18181b' }, memberChipActive: { borderColor: '#fc7a3d', backgroundColor: '#2a1912' }, memberText: { color: '#e4e4e7', fontSize: 12, fontWeight: '700' }, avatar: { width: 28, height: 28, borderRadius: 14 }, avatarPlaceholder: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#3f3f46', alignItems: 'center', justifyContent: 'center' }, avatarLetter: { color: '#fafafa', fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, statCard: { ...panel, width: '48%', flexGrow: 1, padding: 13, gap: 3 }, statValue: { color: '#fafafa', fontSize: 20, fontWeight: '900' },
  weekCard: { ...panel, gap: 10, borderColor: '#7c2d12' }, arenaCard: { ...panel, gap: 8 }, cardTitle: { color: '#fafafa', fontSize: 17, fontWeight: '800' }, copy: { color: '#a1a1aa', fontSize: 13, lineHeight: 19 }, orange: { color: '#fc7a3d', fontSize: 12, fontWeight: '800' },
  inlineRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 }, spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, dayOption: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3f3f46' }, dayOptionActive: { backgroundColor: '#ea580c', borderColor: '#fb923c' }, dayText: { color: '#fafafa', fontWeight: '800' }, primaryButton: { padding: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#ea580c' }, primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  tabRow: { gap: 7, paddingVertical: 4 }, tab: { borderRadius: 22, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a' }, tabActive: { backgroundColor: '#7c2d12', borderColor: '#ea580c' }, tabText: { color: '#a1a1aa', fontSize: 12, fontWeight: '700' }, tabTextActive: { color: '#fff' }, section: { ...panel, gap: 13 }, stack: { gap: 12 }, planWeek: { borderTopWidth: 1, borderTopColor: '#3f3f46', paddingTop: 10, gap: 8 }, workout: { backgroundColor: '#09090b', borderRadius: 10, padding: 10, gap: 4 },
  filter: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 18, backgroundColor: '#27272a' }, filterActive: { backgroundColor: '#7c2d12' }, filterText: { color: '#a1a1aa', fontSize: 12, fontWeight: '700' }, filterTextActive: { color: '#fff' }, activityCard: { paddingVertical: 13, borderTopWidth: 1, borderTopColor: '#27272a', gap: 4 }, activityName: { flex: 1, color: '#f4f4f5', fontSize: 13, fontWeight: '800' }, detailBlock: { marginTop: 8, padding: 12, gap: 6, borderRadius: 12, backgroundColor: '#09090b' }, secondaryButton: { borderRadius: 12, borderWidth: 1, borderColor: '#3f3f46', padding: 11, alignItems: 'center' }, secondaryButtonText: { color: '#e4e4e7', fontSize: 12, fontWeight: '800' },
  subheading: { color: '#e4e4e7', fontWeight: '800', fontSize: 14, marginTop: 5 }, input: { flex: 1, minWidth: 120, color: '#fafafa', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 10, padding: 11, fontSize: 13 }, badgeRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#27272a' }, badgeLocked: { opacity: 0.55 }, badgeIcon: { fontSize: 23 }, notification: { padding: 12, borderRadius: 12, backgroundColor: '#09090b', gap: 6 }, notificationUnread: { borderWidth: 1, borderColor: '#7c2d12' }, statusMessage: { color: '#fdba74', fontSize: 12 }, errorBox: { ...panel, gap: 8 }, errorText: { color: '#fca5a5' }, actionLink: { color: '#fb923c', fontWeight: '800' }, footer: { color: '#52525b', fontSize: 10, textAlign: 'center' },
});
