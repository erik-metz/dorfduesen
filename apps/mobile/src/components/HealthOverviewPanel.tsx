import { Text, View } from 'react-native';

type HealthSignal = { value: number; unit: string; measuredAt: string; provider: string; sourceName: string | null } | null;
export type HealthOverviewData = {
  from: string;
  to: string;
  recordCount: number;
  providers: string[];
  signals: {
    deviceVo2max: HealthSignal;
    restingHeartRate: HealthSignal;
    heartRateVariability: HealthSignal;
    weight: HealthSignal;
    bodyFat: HealthSignal;
    oxygenSaturation: HealthSignal;
    respiratoryRate: HealthSignal;
  };
  recordCounts: { workouts: number; sleep: number; steps: number; heartRateSamples: number };
  weeklyTrends: Array<{
    weekStart: string;
    deviceVo2max: number | null;
    restingHeartRate: number | null;
    heartRateVariability: number | null;
    weight: number | null;
    stepsPerDay: number | null;
    sleepHours: number | null;
  }>;
  activityMatches: Array<{
    healthRecordId: string;
    provider: string;
    sourceName: string | null;
    startAt: string;
    sport: string;
    status: 'already_in_strava' | 'health_only';
    strava: { id: string; name: string; sportType: string; startAt: string } | null;
  }>;
  matchedWorkoutCount: number;
  healthOnlyWorkoutCount: number;
};

const providerName = (provider: string) => provider === 'APPLE_HEALTH' ? 'Apple Health' : provider === 'HEALTH_CONNECT' ? 'Health Connect' : provider;

function TrendCard({ title, unit, values, color }: { title: string; unit: string; values: Array<{ weekStart: string; value: number | null }>; color: string }) {
  const finiteValues = values.flatMap(item => item.value === null || !Number.isFinite(item.value) ? [] : [item.value]);
  const min = finiteValues.length ? Math.min(...finiteValues) : 0;
  const max = finiteValues.length ? Math.max(...finiteValues) : 1;
  const latest = [...values].reverse().find(item => item.value !== null && Number.isFinite(item.value))?.value;
  if (latest == null) return null;
  return <View style={{ flexBasis: '47%', flexGrow: 1, minWidth: 145, padding: 12, gap: 8, borderRadius: 13, backgroundColor: '#09090b', borderWidth: 1, borderColor: '#27272a' }}>
    <View style={{ gap: 2 }}><Text style={{ color: '#a1a1aa', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>{title} · 12 Wochen</Text><Text style={{ color: '#f4f4f5', fontSize: 17, fontWeight: '900' }}>{`${Number(latest.toFixed(1))} ${unit}`}</Text></View>
    <View accessibilityRole="image" accessibilityLabel={`${title}, Wochenwerte: ${values.map(item => `${new Date(`${item.weekStart}T00:00:00.000Z`).toLocaleDateString('de-DE')}: ${item.value === null ? 'keine Daten' : `${item.value.toFixed(1)} ${unit}`}`).join(', ')}`} style={{ height: 42, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
      {values.map(item => {
        const height = item.value === null ? 4 : max === min ? 24 : 8 + ((item.value - min) / (max - min)) * 34;
        return <View key={item.weekStart} accessibilityLabel={`${item.weekStart}: ${item.value ?? 'keine Daten'}`} style={{ flex: 1, height, borderRadius: 3, backgroundColor: item.value === null ? '#27272a' : color }} />;
      })}
    </View>
  </View>;
}

function SignalCard({ title, signal }: { title: string; signal: HealthSignal }) {
  if (!signal) return null;
  return <View style={{ flexBasis: '47%', flexGrow: 1, minWidth: 135, padding: 12, gap: 4, borderRadius: 13, backgroundColor: '#09090b', borderWidth: 1, borderColor: '#27272a' }}>
    <Text style={{ color: '#a1a1aa', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>{title}</Text>
    <Text style={{ color: '#f4f4f5', fontSize: 20, fontWeight: '900' }}>{`${Number(signal.value.toFixed(1))} ${signal.unit}`}</Text>
    <Text style={{ color: '#71717a', fontSize: 10 }}>{new Date(signal.measuredAt).toLocaleDateString('de-DE')} · {providerName(signal.provider)}{signal.sourceName ? ` · ${signal.sourceName}` : ''}</Text>
  </View>;
}

export function HealthOverviewPanel({ data }: { data: HealthOverviewData }) {
  const recentMatches = data.activityMatches.slice(-3).reverse();
  const hasSignals = Object.values(data.signals).some(Boolean);
  const hasTrends = data.weeklyTrends.some(point => Object.values(point).some(value => typeof value === 'number' && Number.isFinite(value)));
  const hasActivityData = data.recordCounts.workouts > 0 || data.recordCounts.sleep > 0 || data.recordCounts.steps > 0 || data.recordCounts.heartRateSamples > 0;
  if (!hasSignals && !hasTrends && !hasActivityData) return null;
  return <View style={{ padding: 15, gap: 12, borderRadius: 18, backgroundColor: '#18181b', borderColor: '#3f3f46', borderWidth: 1 }}>
    <View style={{ gap: 4 }}>
      <Text style={{ color: '#fafafa', fontSize: 17, fontWeight: '900' }}>Health-Messwerte & Quellen</Text>
      <Text style={{ color: '#a1a1aa', fontSize: 12, lineHeight: 18 }}>Gerätemessungen bleiben von Strava-Schätzungen und manuellen Profilwerten getrennt. Jede Messung zeigt Datum und Quelle.</Text>
    </View>
    {hasSignals ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <SignalCard title="VO₂max vom Gerät" signal={data.signals.deviceVo2max} />
      <SignalCard title="Ruhepuls" signal={data.signals.restingHeartRate} />
      <SignalCard title="Herzratenvariabilität" signal={data.signals.heartRateVariability} />
      <SignalCard title="Körpergewicht" signal={data.signals.weight} />
      <SignalCard title="Körperfett" signal={data.signals.bodyFat} />
      <SignalCard title="Atemfrequenz" signal={data.signals.respiratoryRate} />
      <SignalCard title="Sauerstoffsättigung" signal={data.signals.oxygenSaturation} />
    </View> : null}
    {hasTrends ? <View style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: '#27272a', gap: 8 }}>
      <Text style={{ color: '#e4e4e7', fontSize: 13, fontWeight: '800' }}>Health-Trends · 12 Wochen</Text>
      <Text style={{ color: '#71717a', fontSize: 10, lineHeight: 15 }}>Wochenmediane bzw. Tagesmittel aus vorhandenen Gerätedaten (nach UTC-Datum gruppiert). Die Trends sind beschreibend und keine medizinische Bewertung.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <TrendCard title="Geräte-VO₂max" unit="ml/kg/min" color="#22d3ee" values={data.weeklyTrends.map(point => ({ weekStart: point.weekStart, value: point.deviceVo2max }))} />
        <TrendCard title="Ruhepuls" unit="bpm" color="#fb923c" values={data.weeklyTrends.map(point => ({ weekStart: point.weekStart, value: point.restingHeartRate }))} />
        <TrendCard title="HRV" unit="ms" color="#a78bfa" values={data.weeklyTrends.map(point => ({ weekStart: point.weekStart, value: point.heartRateVariability }))} />
        <TrendCard title="Schlaf" unit="h/Nacht" color="#60a5fa" values={data.weeklyTrends.map(point => ({ weekStart: point.weekStart, value: point.sleepHours }))} />
        <TrendCard title="Schritte" unit="/Tag" color="#4ade80" values={data.weeklyTrends.map(point => ({ weekStart: point.weekStart, value: point.stepsPerDay }))} />
        <TrendCard title="Gewicht" unit="kg" color="#f472b6" values={data.weeklyTrends.map(point => ({ weekStart: point.weekStart, value: point.weight }))} />
      </View>
    </View> : null}
    {hasActivityData ? <View style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: '#27272a', gap: 6 }}>
      <Text style={{ color: '#e4e4e7', fontSize: 13, fontWeight: '800' }}>Gemeinsame Aktivitätsbasis · letzte 26 Wochen</Text>
      <Text style={{ color: '#a1a1aa', fontSize: 12, lineHeight: 18 }}>
        {data.recordCounts.workouts} Health-Workouts · {data.matchedWorkoutCount} zeitlich und nach Sport Strava zugeordnet · {data.healthOnlyWorkoutCount} ohne passende Strava-Aktivität.
      </Text>
      {recentMatches.length ? recentMatches.map(match => <View key={match.healthRecordId} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 4 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ color: '#d4d4d8', fontSize: 11, fontWeight: '700' }}>{match.strava?.name ?? `${match.sport === 'OTHER' ? 'Workout' : match.sport} · ${providerName(match.provider)}`}</Text>
          <Text style={{ color: '#71717a', fontSize: 10 }}>{new Date(match.startAt).toLocaleDateString('de-DE')}</Text>
        </View>
        <Text style={{ color: match.status === 'already_in_strava' ? '#86efac' : '#fdba74', fontSize: 10, fontWeight: '700', textAlign: 'right' }}>
          {match.status === 'already_in_strava' ? 'Strava zugeordnet' : 'Health-only'}
        </Text>
      </View>) : null}
      <Text style={{ color: '#71717a', fontSize: 10, lineHeight: 15 }}>Zuordnung über Sportart, Startzeit innerhalb von 8 Minuten und – falls vorhanden – Dauer innerhalb von 20 %. Originaldaten und Quellen bleiben unverändert erhalten.</Text>
      <Text style={{ color: '#a1a1aa', fontSize: 10 }}>Zusätzlich importiert: {data.recordCounts.sleep} Schlaf-, {data.recordCounts.steps} Schritt- und {data.recordCounts.heartRateSamples} Pulsdatensätze.</Text>
    </View> : null}
    <Text style={{ color: '#71717a', fontSize: 10 }}>
      {data.recordCount} für diese Ansicht berücksichtigte Health-Datensätze · {data.providers.map(providerName).join(' + ') || 'keine Health-Quelle'} · Betrachtungsfenster ab {new Date(data.from).toLocaleDateString('de-DE')}
    </Text>
  </View>;
}
