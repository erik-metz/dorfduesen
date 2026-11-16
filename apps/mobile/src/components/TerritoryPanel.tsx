import { useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { TerritoryData } from '../../../../lib/territory/types';

const km2 = (area: number) => `${(area / 1e6).toFixed(3)} km²`;
// Web Mercator coordinates match the OpenStreetMap tile grid.
function project(p: number[]) {
  const lat = Math.max(-85, Math.min(85, p[1])) * Math.PI / 180;
  return [(p[0] + 180) / 360, (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2];
}

export function TerritoryPanel({ data }: { data: TerritoryData | undefined }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [width, setWidth] = useState(320);
  const [zoomDelta, setZoomDelta] = useState(0);
  const [offset, setOffset] = useState([0, 0]);
  const [rules, setRules] = useState(false);
  const [tileError, setTileError] = useState(false);
  const camera = useMemo(() => {
    const points = data?.territories.flatMap(t => t.geometry.type === 'Polygon' ? t.geometry.coordinates.flat() : t.geometry.coordinates.flat(2)).map(project) ?? [];
    if (!points.length) { const center = project([8.407, 49.684]); return { center, zoom: 13 }; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of points) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    const zoom = Math.max(1, Math.min(16, Math.floor(Math.log2(Math.min((width - 40) / (256 * Math.max(maxX - minX, 1e-8)), 240 / (256 * Math.max(maxY - minY, 1e-8)))))));
    return { center: [(minX + maxX) / 2, (minY + maxY) / 2], zoom };
  }, [data?.territories, width]);
  if (!data) return null;
  const zoom = Math.max(1, Math.min(19, camera.zoom + zoomDelta));
  const scale = 256 * 2 ** zoom;
  const cx = camera.center[0] * scale + offset[0], cy = camera.center[1] * scale + offset[1];
  const left = cx - width / 2, top = cy - 150;
  const tiles: Array<{ x: number; y: number }> = [];
  for (let x = Math.floor(left / 256); x <= Math.floor((left + width) / 256); x++) {
    for (let y = Math.floor(top / 256); y <= Math.floor((top + 300) / 256); y++) {
      if (x >= 0 && y >= 0 && x < 2 ** zoom && y < 2 ** zoom) tiles.push({ x, y });
    }
  }
  const selected = data.territories.find(t => t.id === selectedId);
  const move = (x: number, y: number) => setOffset(([ox, oy]) => [ox + x, oy + y]);
  const changeZoom = (delta: number) => { const effective = Math.max(1, Math.min(19, zoom + delta)) - zoom; setZoomDelta(z => z + effective); setOffset(([x, y]) => [x * 2 ** effective, y * 2 ** effective]); };
  return <View style={styles.panel}>
    <Text style={styles.title}>Dein Revier</Text>
    <Text style={styles.area}>{km2(data.myAreaM2)}</Text>
    <Text style={styles.copy}>{data.season.key} · bis {new Date(new Date(data.season.end).getTime() - 1).toLocaleDateString('de-DE')} · Orange: du · Blau: andere</Text>
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.map}>
      {tiles.map(tile => <Image alt="" key={`${zoom}:${tile.x}:${tile.y}`} source={{ uri: `https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png` }} style={{ position: 'absolute', left: tile.x * 256 - left, top: tile.y * 256 - top, width: 256, height: 256 }} onError={() => setTileError(true)} />)}
      <Svg width={width} height={300} accessibilityLabel="Revierkarte mit auswählbaren Gebieten">
        {data.territories.map(t => {
          const polygons = t.geometry.type === 'Polygon' ? [t.geometry.coordinates] : t.geometry.coordinates;
          const d = polygons.map(rings => rings.map(ring => ring.map((p, i) => { const [x, y] = project(p); return `${i ? 'L' : 'M'}${(x * scale - left).toFixed(2)},${(y * scale - top).toFixed(2)}`; }).join(' ') + ' Z').join(' ')).join(' ');
          const color = t.mine ? '#f97316' : '#38bdf8';
          return <Path key={t.id} d={d} fill={color} fillOpacity={0.3} stroke={selectedId === t.id ? '#fff' : color} strokeWidth={2} fillRule="evenodd" onPress={() => setSelectedId(t.id)} accessibilityLabel={`Gebiet von ${t.ownerName}, ${km2(t.areaM2)}`} />;
        })}
      </Svg>
    </View>
    <View style={styles.controls}>{[['＋', () => changeZoom(1)], ['−', () => changeZoom(-1)], ['←', () => move(-100, 0)], ['↑', () => move(0, -100)], ['↓', () => move(0, 100)], ['→', () => move(100, 0)], ['Alle', () => { setZoomDelta(0); setOffset([0, 0]); }]].map(([label, action]) => <Pressable key={String(label)} accessibilityRole="button" accessibilityLabel={String(label)} onPress={action as () => void} style={styles.button}><Text style={styles.text}>{String(label)}</Text></Pressable>)}</View>
    <Pressable onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')}><Text style={styles.copy}>© OpenStreetMap-Mitwirkende</Text></Pressable>
    {tileError ? <Text style={styles.copy}>Hintergrundkarte nicht verfügbar. Gebiete werden weiterhin angezeigt.</Text> : null}
    {selected ? <View><Text style={styles.text}>{selected.ownerName} · {km2(selected.areaM2)}</Text><Text style={styles.copy}>{selected.lastActivityName} · Eingenommen: {new Date(selected.capturedAt).toLocaleString('de-DE')}</Text>{selected.history.map((e, i) => <Text key={i} style={styles.copy}>{e.fromName ?? 'Freie Fläche'} → {e.toName}</Text>)}</View> : null}
    {!data.territories.length ? <Text style={styles.copy}>Noch freie Karte: Nimm mit deinem nächsten Rundlauf das erste Gebiet ein.</Text> : null}
    <Text style={styles.heading}>Flächenrangliste</Text>
    {data.leaderboard.map((entry, i) => <Text key={entry.userId} style={styles.text}>{i + 1}. {entry.name} · {km2(entry.areaM2)}</Text>)}
    <Text style={styles.heading}>Deine letzten Läufe</Text>
    {data.myRuns.map(run => <View key={run.id}><Text style={styles.text}>{run.name}</Text><Text style={styles.copy}>{run.message}</Text></View>)}
    <Pressable onPress={() => setRules(value => !value)} accessibilityRole="button"><Text style={styles.heading}>{rules ? 'Regeln schließen' : 'So funktioniert die Eroberung'}</Text></Pressable>
    {rules ? <Text style={styles.copy}>Outdoor-Läufe und Trailruns ab Saisonstart zählen. Start und Ziel: maximal 100 m und 5 % Streckenabstand. Mindestens 10.000 m², keine Selbstkreuzung und keine GPS-Lücken. Private, manuelle und Indoor-Aktivitäten zählen nicht. Fremde Gebiete musst du vollständig umlaufen (10 m GPS-Toleranz); teilweise Überschneidungen ändern deren Besitz nicht. Freie Flächen gehören dir, eigene Flächen zählen nur einmal. Der Laufabschluss entscheidet, bei gleicher Zeit die Aktivitäts-ID. Läufe über Saisongrenzen zählen nicht. Jedes Quartal beginnt eine neue Saison. Strava-Änderungen und Löschungen werden täglich geprüft. Zum Aktualisieren die Arena nach unten ziehen.</Text> : null}
    <Text style={styles.heading}>Letzte Gebietswechsel</Text>
    {data.events.slice(0, 10).map((e, i) => <Text key={`${e.claimId}:${e.territoryId}:${i}`} style={styles.copy}>{e.toName} {e.fromName ? `erobert von ${e.fromName}` : 'nimmt freie Fläche ein'} · {km2(e.areaM2)}</Text>)}
  </View>;
}
const styles = StyleSheet.create({
  panel: { borderRadius: 20, borderWidth: 1, borderColor: '#7c2d12', backgroundColor: '#18181b', padding: 16, gap: 10 },
  title: { color: '#fafafa', fontSize: 24, fontWeight: '900' }, area: { color: '#fb923c', fontSize: 28, fontWeight: '900' },
  heading: { color: '#fafafa', fontSize: 14, fontWeight: '800', marginTop: 8 }, text: { color: '#fafafa', fontSize: 12 }, copy: { color: '#a1a1aa', fontSize: 11, lineHeight: 17 },
  map: { overflow: 'hidden', height: 300, backgroundColor: '#27272a', borderRadius: 12 }, controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  button: { backgroundColor: '#3f3f46', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
});
