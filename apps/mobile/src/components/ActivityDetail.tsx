import { useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';

type Detail = Record<string, any>;
const colors = { panel: '#09090b', card: '#18181b', border: '#27272a', text: '#f4f4f5', muted: '#a1a1aa', orange: '#fb923c' };

function duration(value: number) { const s = Math.max(0, Math.round(value || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function decodePolyline(encoded?: string) {
  if (!encoded) return [];
  const points: Array<[number, number]> = []; let index = 0; let lat = 0; let lng = 0;
  while (index < encoded.length) {
    let result = 0; let shift = 0; let byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < encoded.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0; shift = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < encoded.length);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

export function ActivityDetail({ detail }: { detail: Detail }) {
  const [metric, setMetric] = useState<'altitude' | 'heartrate' | 'speed'>('altitude');
  const ride = String(detail.sportType || '').toLowerCase().includes('ride');
  const streams = Array.isArray(detail.streams) ? detail.streams : [];
  const splits = Array.isArray(detail.splitsMetric) ? detail.splitsMetric : [];
  const efforts = Array.isArray(detail.bestEfforts) ? detail.bestEfforts : [];
  const segments = Array.isArray(detail.segmentEfforts) ? detail.segmentEfforts : [];
  const track = useMemo(() => decodePolyline(detail.detailedPolyline || detail.summaryPolyline), [detail.detailedPolyline, detail.summaryPolyline]);
  const metricValues = streams.map((point: Detail) => Number(point[metric === 'altitude' ? 'altitude' : metric === 'heartrate' ? 'heartrate' : 'speed'])).filter(Number.isFinite);
  const minimum = metricValues.length ? Math.min(...metricValues) : 0;
  const range = Math.max(1, (metricValues.length ? Math.max(...metricValues) : 1) - minimum);
  const sampled = streams.filter((_: Detail, index: number) => index % Math.max(1, Math.ceil(streams.length / 36)) === 0);
  const card = { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 } as const;
  const label = { color: colors.muted, fontSize: 11, fontWeight: '700' as const, textTransform: 'uppercase' as const };
  const value = { color: colors.text, fontWeight: '800' as const, fontSize: 15 };
  const sectionTitle = (text: string) => <Text style={[label, { color: '#d4d4d8', fontSize: 12 }]}>{text}</Text>;

  return <View style={{ gap: 14 }}>
    {detail.description ? <Text style={{ color: '#d4d4d8', fontSize: 12, fontStyle: 'italic', backgroundColor: colors.panel, borderRadius: 12, padding: 12 }}>„{detail.description}“</Text> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {[
        detail.calories != null && [`Kalorien`, `${Math.round(detail.calories)} kcal`],
        detail.averageHeartrate != null && [`Herzfrequenz`, `${Math.round(detail.averageHeartrate)} Ø bpm${detail.maxHeartrate ? ` · max ${Math.round(detail.maxHeartrate)}` : ''}`],
        detail.averageCadence != null && [ride ? 'Trittfrequenz' : 'Schrittfrequenz', `${Math.round(ride ? detail.averageCadence : detail.averageCadence * 2)} ${ride ? 'rpm' : 'spm'}`],
        detail.averageWatts != null && ['Leistung', `${Math.round(detail.averageWatts)} Ø W`],
        (detail.elevHigh != null || detail.elevLow != null) && ['Höhe min/max', `${Math.round(detail.elevLow ?? 0)}–${Math.round(detail.elevHigh ?? 0)} m`],
        detail.sufferScore != null && ['Relative Effort', `${detail.sufferScore} Score`],
        detail.averageTemp != null && ['Temperatur', `${Math.round(detail.averageTemp)} °C`],
        detail.gear?.name && [ride ? 'Fahrrad' : 'Schuhe', `${detail.gear.name}${detail.gear.distance ? ` · ${(detail.gear.distance / 1000).toFixed(0)} km` : ''}`],
        detail.deviceName && ['Aufzeichnung', detail.deviceName],
      ].filter(Boolean).map((item: any) => <View key={item[0]} style={[card, { width: '48%', flexGrow: 1, padding: 11, gap: 5 }]}><Text style={label}>{item[0]}</Text><Text style={value}>{item[1]}</Text></View>)}
    </View>
    <View style={card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><View>{sectionTitle('Sensorverlauf')}<Text style={{ color: colors.muted, fontSize: 10, marginTop: 3 }}>Bewegungszeit: {duration(Number(detail.movingTime))}</Text></View></View>
      {streams.length >= 2 ? <>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{([['altitude', 'Höhe'], ['heartrate', 'Puls'], ['speed', ride ? 'Tempo' : 'Pace']] as const).filter(([key]) => streams.some((p: Detail) => p[key === 'altitude' ? 'altitude' : key === 'heartrate' ? 'heartrate' : 'speed'] != null)).map(([key, title]) => <Pressable key={key} onPress={() => setMetric(key)} style={{ backgroundColor: metric === key ? '#c2410c' : '#27272a', paddingVertical: 7, paddingHorizontal: 10, borderRadius: 9 }}><Text style={{ color: colors.text, fontSize: 11, fontWeight: '700' }}>{title}</Text></Pressable>)}</View>
        <View style={{ height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingTop: 8 }}>{sampled.map((point: Detail, index: number) => { const k = metric === 'altitude' ? 'altitude' : metric === 'heartrate' ? 'heartrate' : 'speed'; const n = Number(point[k]); return <View key={index} style={{ flex: 1, height: `${Math.max(5, ((n - minimum) / range) * 95)}%`, borderRadius: 2, backgroundColor: metric === 'heartrate' ? '#fb7185' : metric === 'speed' ? '#22d3ee' : colors.orange }} />; })}</View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.muted, fontSize: 10 }}>0 km</Text><Text style={{ color: colors.muted, fontSize: 10 }}>{(Number(detail.distance) / 1000).toFixed(1)} km</Text></View>
      </> : <Text style={{ color: colors.muted, fontSize: 12 }}>Keine detaillierten Sensordaten (Streams) für diese Aktivität verfügbar.</Text>}
    </View>
    {track.length > 1 ? <View style={card}>
      {sectionTitle(`GPS-Strecke · ${(Number(detail.distance) / 1000).toFixed(2)} km`)}
      <View style={{ height: 170, backgroundColor: colors.panel, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {(() => { const lats = track.map(p => p[0]); const lngs = track.map(p => p[1]); const minLat = Math.min(...lats); const maxLat = Math.max(...lats); const minLng = Math.min(...lngs); const maxLng = Math.max(...lngs); const latRange = maxLat - minLat || 1e-5; const lngRange = maxLng - minLng || 1e-5; return <View style={{ width: '90%', height: '80%' }}>{track.filter((_: unknown, i: number) => i % Math.max(1, Math.ceil(track.length / 140)) === 0).map((p, i) => <View key={i} style={{ position: 'absolute', width: 4, height: 4, borderRadius: 3, backgroundColor: colors.orange, left: `${((p[1] - minLng) / lngRange) * 96}%`, top: `${(1 - (p[0] - minLat) / latRange) * 90}%` }} />)}</View>; })()}
      </View><Text style={{ color: colors.muted, fontSize: 10, textAlign: 'center' }}>GPS-Track aus Strava</Text>
    </View> : null}
    {splits.length ? <View style={card}>{sectionTitle('Kilometer-Splits')}<ScrollView horizontal><View><View style={{ flexDirection: 'row', gap: 14, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}><Text style={[label, { width: 44 }]}>KM</Text><Text style={[label, { width: 66 }]}>Zeit</Text><Text style={[label, { width: 56 }]}>Tempo</Text><Text style={[label, { width: 54 }]}>Höhe</Text><Text style={[label, { width: 56 }]}>Puls</Text></View>{splits.map((split: Detail, index: number) => <View key={index} style={{ flexDirection: 'row', gap: 14, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#202024' }}><Text style={[value, { width: 44, fontSize: 12 }]}>{split.split}</Text><Text style={[value, { width: 66, fontSize: 12 }]}>{duration(split.moving_time)}</Text><Text style={[value, { width: 56, fontSize: 12 }]}>{ride ? `${(split.average_speed * 3.6).toFixed(1)}` : duration(1000 / split.average_speed)}</Text><Text style={[value, { width: 54, fontSize: 12 }]}>{Math.round(split.elevation_difference)} m</Text><Text style={[value, { width: 56, fontSize: 12 }]}>{split.average_heartrate ? `${Math.round(split.average_heartrate)}` : '–'}</Text></View>)}</View></ScrollView></View> : null}
    {efforts.length ? <View style={card}>{sectionTitle('Abschnitts-Bestzeiten')}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{efforts.map((effort: Detail) => <View key={effort.id} style={{ width: '48%', backgroundColor: effort.pr_rank === 1 ? '#422006' : colors.panel, borderRadius: 10, padding: 10 }}><Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>{effort.name}{effort.pr_rank ? ` · PR #${effort.pr_rank}` : ''}</Text><Text style={[value, { marginTop: 4 }]}>{duration(effort.moving_time)}</Text></View>)}</View></View> : null}
    {segments.length ? <View style={card}>{sectionTitle(`Strava-Segmente (${segments.length})`)}{segments.map((segment: Detail) => <View key={segment.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>{segment.name}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>{(segment.distance / 1000).toFixed(2)} km{segment.segment?.average_grade ? ` · ${segment.segment.average_grade.toFixed(1)}% Steigung` : ''}</Text></View><Text style={value}>{duration(segment.moving_time)}{segment.pr_rank ? ` · PR #${segment.pr_rank}` : ''}</Text></View>)}</View> : null}
    {detail.photos?.primaryUrl ? <View style={card}>{sectionTitle(`Strava-Fotos (${detail.photos.count || 1})`)}<Image source={{ uri: detail.photos.primaryUrl }} resizeMode="cover" style={{ height: 220, borderRadius: 12 }} /></View> : null}
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://www.strava.com/activities/${encodeURIComponent(String(detail.stravaId))}`)} style={{ padding: 12, borderRadius: 10, backgroundColor: '#27272a', alignItems: 'center' }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>Auf Strava öffnen ↗</Text></Pressable>
  </View>;
}
