import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';

type LeaderboardEntry = {
  rank: number; userId: string; name: string; profile: string | null; totalDistanceKm: number;
  totalHours: number; totalElevation: number; activityCount: number; averagePace: string; badgesCount: number;
};
type Champion = {
  id: string; title: string; subtitle: string; icon: string;
  kind?: 'recognition';
  winner: null | { userId: string; name: string; profile: string | null; value: number; formattedValue: string };
  recipients?: Array<{ userId: string; name: string; profile: string | null; value: number; formattedValue: string }>;
};
type ArenaData = {
  filters: { period: 'week' | 'month' | 'all'; sport: 'all' | 'run' | 'ride' };
  summary: { weekKm: number; weekHours: number; weekActivitiesCount: number; activeAthletesCount: number };
  challenge: { title: string; description: string; targetKm: number; currentKm: number; percentage: number; daysRemaining: number };
  champions: Champion[];
  leaderboard: LeaderboardEntry[];
  recentActivities: Array<{ id: string; stravaId: string; name: string; sportType: string; distanceKm: number; movingTime: number; startDate: string; userId: string; userName: string; userProfile: string | null }>;
  badges: Array<{ code: string; name: string; description: string; icon: string; category: string }>;
};

const periods = [['week', 'Woche'], ['month', 'Monat'], ['all', 'Gesamt']] as const;
const sports = [['all', 'Alle'], ['run', 'Lauf'], ['ride', 'Rad']] as const;
type SortBy = 'distance' | 'time' | 'elevation' | 'activities';
const sortLabels: Array<[SortBy, string]> = [['distance', 'Distanz'], ['time', 'Zeit'], ['elevation', 'Höhe'], ['activities', 'Einheiten']];
const panel = { borderRadius: 20, borderWidth: 1, borderColor: '#27272a', backgroundColor: '#18181b', padding: 17 } as const;

async function responseJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Arena konnte nicht geladen werden.');
  return data as T;
}

export default function ArenaScreen() {
  const { apiFetch } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState<ArenaData['filters']['period']>('week');
  const [sport, setSport] = useState<ArenaData['filters']['sport']>('all');
  const [sortBy, setSortBy] = useState<SortBy>('distance');
  const [data, setData] = useState<ArenaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadArena = useCallback(async (showLoading = true, forceRefresh = false) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ period, sport });
      const result = await responseJson<ArenaData>(await apiFetch(`/api/mobile/arena?${query}`, forceRefresh ? { cache: 'no-store' } : undefined));
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Arena konnte nicht geladen werden.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [apiFetch, period, sport]);

  useEffect(() => { void loadArena(); }, [loadArena]);
  const sortedLeaderboard = useMemo(() => [...(data?.leaderboard ?? [])].sort((a, b) => {
    if (sortBy === 'time') return b.totalHours - a.totalHours;
    if (sortBy === 'elevation') return b.totalElevation - a.totalElevation;
    if (sortBy === 'activities') return b.activityCount - a.activityCount;
    return b.totalDistanceKm - a.totalDistanceKm;
  }), [data?.leaderboard, sortBy]);
  const featuredChampions = useMemo(() => {
    const shown = new Set<string>();
    return (data?.champions ?? []).map(champion => {
      const recipients = champion.recipients ?? (champion.winner ? [champion.winner] : []);
      const featured = champion.kind === 'recognition'
        ? recipients.find(recipient => !shown.has(recipient.userId)) ?? recipients[0]
        : champion.winner ?? recipients[0];
      if (featured) shown.add(featured.userId);
      return { champion, featured, recipientCount: recipients.length };
    });
  }, [data?.champions]);

  const openMember = (userId: string) => router.push({ pathname: '/(tabs)/dashboard', params: { userId } });
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return minutes >= 60 ? `${Math.floor(minutes / 60)} Std ${minutes % 60} Min` : `${minutes} Min`;
  };

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadArena(false, true); }} tintColor="#fc7a3d" />}>
    <Text style={styles.kicker}>RUNCLUB NORDHEIM</Text>
    <Text style={styles.heading}>Düsen-Arena</Text>
    <Text style={styles.intro}>Gemeinsam Kilometer sammeln, Wochenziele feiern und sehen, wer gerade vorne liegt.</Text>
    {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void loadArena()}><Text style={styles.orange}>Erneut laden</Text></Pressable></View> : null}
    {loading && !data ? <ActivityIndicator color="#fc7a3d" size="large" style={{ marginTop: 40 }} /> : data ? <>
      <View style={styles.kpiGrid}>
        <Kpi label="Wochenkilometer" value={`${data.summary.weekKm.toFixed(1)} km`} detail="Seit Montag" />
        <Kpi label="Bewegungszeit" value={`${data.summary.weekHours.toFixed(1)} h`} detail="Gemeinsam unterwegs" />
        <Kpi label="Aktivitäten" value={String(data.summary.weekActivitiesCount)} detail="Diese Woche" />
        <Kpi label="Aktive Düsen" value={String(data.summary.activeAthletesCount)} detail="Diese Woche" />
      </View>

      <View style={styles.challenge}>
        <Text style={styles.kicker}>AKTUELLE TEAM-CHALLENGE</Text>
        <Text style={styles.cardTitle}>{data.challenge.title}</Text>
        <Text style={styles.copy}>{data.challenge.description}</Text>
        <View style={styles.challengeNumbers}><Text style={styles.challengeValue}>{data.challenge.currentKm.toFixed(1)} <Text style={styles.challengeTarget}>/ {data.challenge.targetKm} km</Text></Text><Text style={styles.orange}>Noch {data.challenge.daysRemaining} Tage</Text></View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, data.challenge.percentage))}%` }]} /></View>
        <View style={styles.spaceBetween}><Text style={styles.small}>{Math.round(data.challenge.percentage)}% erreicht</Text><Text style={styles.small}>Ziel: {data.challenge.targetKm} km</Text></View>
      </View>

      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Champions der Woche</Text><Text style={styles.small}>Montag bis Sonntag</Text></View>
      <View style={styles.championList}>
        {featuredChampions.map(({ champion, featured, recipientCount }) => <View key={champion.id} style={styles.championCard}>
          <Text style={styles.championIcon}>{champion.icon}</Text><View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.cardTitle}>{champion.title}</Text><Text style={styles.small}>{champion.subtitle}</Text>
            {featured ? <Pressable onPress={() => openMember(featured.userId)}><Text style={styles.championWinner}>{featured.name} · {featured.formattedValue}</Text></Pressable> : <Text style={styles.small}>Noch niemand an der Spitze</Text>}
            {recipientCount > 1 ? <Text style={styles.tiny}>{recipientCount} Mitglieder ausgezeichnet</Text> : null}
          </View>
        </View>)}
      </View>

      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Das Düsen-Ranking</Text><Text style={styles.small}>Tippe auf ein Mitglied für sein Profil</Text></View>
      <View style={styles.section}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {periods.map(([value, label]) => <Filter key={value} active={period === value} label={label} onPress={() => setPeriod(value)} />)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {sports.map(([value, label]) => <Filter key={value} active={sport === value} label={label} onPress={() => setSport(value)} />)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {sortLabels.map(([value, label]) => <Pressable key={value} onPress={() => setSortBy(value)}><Text style={[styles.sortOption, sortBy === value && styles.sortActive]}>Sortieren: {label}</Text></Pressable>)}
        </ScrollView>
        {loading ? <ActivityIndicator color="#fc7a3d" /> : sortedLeaderboard.length ? sortedLeaderboard.map((entry, index) => <Pressable key={entry.userId} style={styles.rankRow} onPress={() => openMember(entry.userId)}>
          <Text style={[styles.rankNumber, index === 0 && styles.rankFirst]}>{index + 1}</Text>
          {entry.profile ? <Image source={{ uri: entry.profile }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><Text style={styles.avatarLetter}>{entry.name.slice(0, 1)}</Text></View>}
          <View style={styles.rankMember}><Text style={styles.rankName} numberOfLines={1}>{entry.name}</Text><Text style={styles.tiny}>{entry.activityCount} Aktivitäten · {entry.averagePace}</Text></View>
          <View style={styles.rankStats}><Text style={styles.rankDistance}>{entry.totalDistanceKm.toFixed(1)} km</Text><Text style={styles.tiny}>{sortBy === 'time' ? `${entry.totalHours.toFixed(1)} h` : sortBy === 'elevation' ? `${Math.round(entry.totalElevation)} hm` : sortBy === 'activities' ? `${entry.activityCount} Einheiten` : `${entry.badgesCount} Badges`}</Text></View>
        </Pressable>) : <Text style={styles.copy}>Noch keine Aktivitäten für diese Auswahl.</Text>}
      </View>

      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Neueste Aktivitäten</Text><Text style={styles.small}>Die letzten 20 aus dem Club</Text></View>
      <View style={styles.section}>
        {data.recentActivities.length ? data.recentActivities.map(activity => <Pressable key={activity.id} style={styles.recentRow} onPress={() => openMember(activity.userId)}>
          {activity.userProfile ? <Image source={{ uri: activity.userProfile }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><Text style={styles.avatarLetter}>{activity.userName.slice(0, 1)}</Text></View>}
          <View style={styles.rankMember}><Text style={styles.rankName}>{activity.userName}</Text><Text style={styles.small} numberOfLines={1}>{activity.name}</Text><Text style={styles.tiny}>{activity.sportType} · {new Date(activity.startDate).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {formatDuration(activity.movingTime)}</Text></View>
          <Text style={styles.orange}>{activity.distanceKm.toFixed(1)} km</Text>
        </Pressable>) : <Text style={styles.copy}>Noch keine Aktivitäten im Club.</Text>}
      </View>

      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Düsen-Badges</Text><Text style={styles.small}>Meilensteine und Auszeichnungen</Text></View>
      <View style={styles.badgeGrid}>{data.badges.map(badge => <View key={badge.code} style={styles.badgeCard}><Text style={styles.badgeIcon}>{badge.icon}</Text><Text style={styles.badgeName}>{badge.name}</Text><Text style={styles.tiny}>{badge.category}</Text><Text style={styles.badgeDescription}>{badge.description}</Text></View>)}</View>
    </> : null}
  </ScrollView>;
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <View style={styles.kpiCard}><Text style={styles.small}>{label}</Text><Text style={styles.kpiValue}>{value}</Text><Text style={styles.tiny}>{detail}</Text></View>;
}
function Filter({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable style={[styles.filter, active && styles.filterActive]} onPress={onPress}><Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#09090b' }, content: { padding: 20, gap: 16, paddingBottom: 44 },
  kicker: { color: '#fc7a3d', fontWeight: '900', letterSpacing: 1.6, fontSize: 10 }, heading: { color: '#fafafa', fontSize: 30, fontWeight: '900', marginTop: -11 }, intro: { color: '#a1a1aa', fontSize: 13, lineHeight: 20, marginTop: -8 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, kpiCard: { ...panel, width: '48%', flexGrow: 1, padding: 13, gap: 3 }, kpiValue: { color: '#fafafa', fontSize: 21, fontWeight: '900' }, tiny: { color: '#71717a', fontSize: 10, lineHeight: 15 }, small: { color: '#a1a1aa', fontSize: 11, lineHeight: 17 },
  challenge: { ...panel, gap: 10, borderColor: '#7c2d12', backgroundColor: '#1c1411' }, cardTitle: { color: '#fafafa', fontSize: 15, fontWeight: '800' }, copy: { color: '#a1a1aa', fontSize: 12, lineHeight: 18 }, challengeNumbers: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, challengeValue: { color: '#fff', fontSize: 22, fontWeight: '900' }, challengeTarget: { color: '#a1a1aa', fontSize: 13, fontWeight: '700' }, orange: { color: '#fb923c', fontSize: 11, fontWeight: '900' }, progressTrack: { height: 14, borderRadius: 8, backgroundColor: '#09090b', padding: 2, borderWidth: 1, borderColor: '#3f3f46' }, progressFill: { height: '100%', borderRadius: 6, backgroundColor: '#f97316' }, spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHead: { gap: 3, marginTop: 5 }, sectionTitle: { color: '#fafafa', fontSize: 20, fontWeight: '900' }, championList: { gap: 8 }, championCard: { ...panel, flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 13 }, championIcon: { fontSize: 26 }, championWinner: { color: '#fdba74', fontSize: 12, fontWeight: '800' },
  section: { ...panel, gap: 12 }, filterRow: { gap: 7 }, filter: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18, backgroundColor: '#27272a' }, filterActive: { backgroundColor: '#7c2d12', borderColor: '#ea580c' }, filterText: { color: '#a1a1aa', fontSize: 11, fontWeight: '800' }, filterTextActive: { color: '#fff' }, sortOption: { color: '#71717a', fontSize: 10, paddingVertical: 5, paddingRight: 6 }, sortActive: { color: '#fb923c', fontWeight: '900' }, rankRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: '#27272a', paddingVertical: 10 }, rankNumber: { color: '#a1a1aa', fontSize: 14, fontWeight: '900', width: 20, textAlign: 'center' }, rankFirst: { color: '#fbbf24' }, avatar: { width: 34, height: 34, borderRadius: 17 }, avatarPlaceholder: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#3f3f46', alignItems: 'center', justifyContent: 'center' }, avatarLetter: { color: '#fafafa', fontWeight: '900' }, rankMember: { flex: 1, minWidth: 0, gap: 2 }, rankName: { color: '#f4f4f5', fontSize: 12, fontWeight: '800' }, rankStats: { alignItems: 'flex-end', gap: 2 }, rankDistance: { color: '#fff', fontSize: 13, fontWeight: '900' },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: '#27272a', paddingVertical: 10 }, badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, badgeCard: { ...panel, width: '48%', flexGrow: 1, padding: 12, gap: 4 }, badgeIcon: { fontSize: 24 }, badgeName: { color: '#fafafa', fontSize: 12, fontWeight: '800' }, badgeDescription: { color: '#a1a1aa', fontSize: 10, lineHeight: 15 }, error: { ...panel, gap: 7 }, errorText: { color: '#fca5a5', fontSize: 12 },
});
