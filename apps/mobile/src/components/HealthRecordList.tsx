import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';

const labels: Record<string, string> = {
  workout: 'Workouts', step_count: 'Schritte', distance: 'Distanz', walking_running_distance: 'Geh- und Laufdistanz',
  cycling_distance: 'Raddistanz', swimming_distance: 'Schwimmdistanz', floors_climbed: 'Stockwerke',
  active_energy: 'Aktive Energie', basal_energy: 'Ruheenergie', total_energy: 'Gesamtenergie',
  exercise_time: 'Trainingszeit', stand_time: 'Stehzeit', heart_rate: 'Herzfrequenz', resting_heart_rate: 'Ruhepuls',
  walking_heart_rate_average: 'Gehpuls', heart_rate_variability: 'HRV', oxygen_saturation: 'Sauerstoffsättigung',
  respiratory_rate: 'Atemfrequenz', body_temperature: 'Körpertemperatur', blood_pressure: 'Blutdruck',
  body_mass: 'Gewicht', body_fat_percentage: 'Körperfett', lean_body_mass: 'Fettfreie Masse',
  height: 'Größe', body_water_mass: 'Körperwasser', bone_mass: 'Knochenmasse', vo2_max: 'VO₂max',
  blood_glucose: 'Blutzucker', sleep: 'Schlaf', mindful_session: 'Achtsamkeit', nutrition: 'Ernährung',
  hydration: 'Flüssigkeit', menstrual_flow: 'Menstruation',
};

type Cursor = { before: string; beforeId: string };
type HealthRecord = { id: string; provider: string; recordType: string; startAt: string; endAt: string | null; sourceName: string | null; value: Record<string, unknown> };
type Page = { records: HealthRecord[]; next: Cursor | null };
const number = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 2 });
const nativeUnits: Record<string, string> = { inMeters: 'm', inKilometers: 'km', inKilograms: 'kg', inMetersPerSecond: 'm/s', inKilocalories: 'kcal', inLiters: 'l', inCelsius: '°C' };

function recordValue(record: HealthRecord): string {
  const { value, recordType } = record;
  if (typeof value.quantity === 'number') return [number(value.quantity), value.unit].filter(Boolean).join(' ');
  if (recordType === 'sleep' && typeof value.value === 'number') {
    const stages = ['Im Bett', 'Schlaf', 'Wach', 'Kernschlaf', 'Tiefschlaf', 'REM-Schlaf'];
    return [stages[value.value], duration(record)].filter(Boolean).join(' · ');
  }
  if (recordType === 'workout') {
    const distance = value.totalDistance;
    if (distance && typeof distance === 'object' && 'quantity' in distance && typeof distance.quantity === 'number') {
      return [duration(record) + ' ·', number(distance.quantity), 'unit' in distance ? distance.unit : ''].filter(Boolean).join(' ');
    }
    return duration(record);
  }
  if (recordType === 'sleep') return duration(record);
  for (const [key, unit] of Object.entries({ count: '', beatsPerMinute: 'bpm', heartRateVariabilityMillis: 'ms', percentage: '%', rate: '/min', vo2MillilitersPerMinuteKilogram: 'ml/kg/min' })) {
    if (typeof value[key] === 'number') return [number(value[key]), unit].filter(Boolean).join(' ');
  }
  for (const entry of Object.values(value)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    for (const [key, unit] of Object.entries(nativeUnits)) {
      const metric = (entry as Record<string, unknown>)[key];
      if (typeof metric === 'number') return `${number(metric)} ${unit}`;
    }
  }
  if (Array.isArray(value.samples)) {
    const pulses = value.samples.flatMap(sample => typeof sample?.beatsPerMinute === 'number' ? [sample.beatsPerMinute] : []);
    if (pulses.length) return `${number(pulses.reduce((sum, pulse) => sum + pulse, 0) / pulses.length)} bpm im Mittel · ${pulses.length} Messungen`;
  }
  return 'Gespeichert';
}

function duration(record: HealthRecord) {
  if (!record.endAt) return 'Gespeichert';
  const minutes = (Date.parse(record.endAt) - Date.parse(record.startAt)) / 60_000;
  return minutes > 0 ? `${number(minutes)} min` : 'Gespeichert';
}

export function HealthRecordList({ revision, types }: { revision: number; types: Array<{ type: string; count: number }> }) {
  const { apiFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('');
  const [cursors, setCursors] = useState<Array<Cursor | null>>([null]);
  const [page, setPage] = useState<Page | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const cursor = cursors.at(-1);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: '25' });
    if (type) params.set('type', type);
    if (cursor) {
      params.set('before', cursor.before);
      params.set('beforeId', cursor.beforeId);
    }
    setPage(null);
    setFailed(false);
    void apiFetch(`/api/mobile/health/records?${params}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Abruf fehlgeschlagen');
        const result: Page = await response.json();
        if (!controller.signal.aborted) setPage(result);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [apiFetch, cursor, open, retry, revision, type]);

  function filter(next: string) {
    setType(next);
    setCursors([null]);
  }

  return <View style={styles.list}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)}>
      <Text style={styles.link}>{open ? 'Messwerte ausblenden' : 'Gespeicherte Messwerte ansehen'}</Text>
    </Pressable>
    {open ? <>
      <View style={styles.filters}>
        {[{ type: '', count: 0 }, ...types].map(item => <Pressable
          key={item.type} accessibilityRole="button" accessibilityState={{ selected: type === item.type }}
          style={[styles.filter, type === item.type && styles.selected]} onPress={() => filter(item.type)}>
          <Text style={styles.body}>{item.type ? `${labels[item.type] ?? item.type} (${item.count})` : 'Alle'}</Text>
        </Pressable>)}
      </View>
      {failed ? <Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)}><Text style={styles.link}>Messwerte konnten nicht geladen werden. Erneut versuchen</Text></Pressable> : null}
      {!page && !failed ? <ActivityIndicator color="#fc7a3d" /> : null}
      {page?.records.map(record => <Pressable key={record.id} style={styles.record}
        accessibilityRole="button" accessibilityState={{ expanded: expandedId === record.id }}
        onPress={() => setExpandedId(id => id === record.id ? null : record.id)}>
        <Text style={styles.body}>{labels[record.recordType] ?? record.recordType} · {recordValue(record)}</Text>
        <Text style={styles.meta}>{new Date(record.startAt).toLocaleString('de-DE')} · {record.provider === 'APPLE_HEALTH' ? 'Apple Health' : 'Health Connect'}{record.sourceName ? ` · ${record.sourceName}` : ''}</Text>
        {expandedId === record.id ? <Text selectable style={styles.meta}>{JSON.stringify(record.value, null, 2)}</Text> : null}
      </Pressable>)}
      {page?.records.length === 0 ? <Text style={styles.meta}>Keine Messwerte für diese Auswahl.</Text> : null}
      <View style={styles.filters}>
        {cursors.length > 1 && page ? <Pressable accessibilityRole="button" onPress={() => setCursors(stack => stack.slice(0, -1))}><Text style={styles.link}>Neuere Messwerte</Text></Pressable> : null}
        {page?.next ? <Pressable accessibilityRole="button" onPress={() => setCursors(stack => [...stack, page.next])}><Text style={styles.link}>Ältere Messwerte</Text></Pressable> : null}
      </View>
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  list: { gap: 12, borderTopWidth: 1, borderColor: '#3f3f46', paddingTop: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { padding: 8, borderRadius: 8, backgroundColor: '#27272a' },
  selected: { backgroundColor: '#7c2d12' },
  record: { gap: 3, borderBottomWidth: 1, borderColor: '#27272a', paddingBottom: 8 },
  link: { color: '#fdba74', fontSize: 14, fontWeight: '700' },
  body: { color: '#fafafa', fontSize: 13 },
  meta: { color: '#a1a1aa', fontSize: 12 },
});
