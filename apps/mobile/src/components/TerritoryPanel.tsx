import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { TerritoryData } from '../../../../lib/territory/types';

const km2 = (area: number) => `${(area / 1e6).toFixed(3)} km²`;
// Web Mercator coordinates match the OpenStreetMap tile grid.
function project(p: number[]) {
  const lat = Math.max(-85, Math.min(85, p[1])) * Math.PI / 180;
  return [(p[0] + 180) / 360, (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2];
}

export function TerritoryPanel({ data, loading = false, error, onRetry }: {
  data: TerritoryData | undefined;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [width, setWidth] = useState(320);
  const [zoomDelta, setZoomDelta] = useState(0);
  const [offset, setOffset] = useState([0, 0]);
  const cameraZoomRef = useRef(13);
  const zoomRef = useRef(0);
  const offsetRef = useRef<[number, number]>([0, 0]);
  const mapRef = useRef<View>(null);
  const mapOriginRef = useRef<[number, number]>([0, 0]);
  const gestureRef = useRef<{ mode: 'pan' | 'pinch'; baseZoom: number; baseOffset: [number, number]; baseDx: number; baseDy: number; distance: number; focalX: number; focalY: number } | null>(null);
  const updateView = (nextZoom: number, nextOffset: [number, number]) => {
    zoomRef.current = nextZoom;
    offsetRef.current = nextOffset;
    setZoomDelta(nextZoom);
    setOffset(nextOffset);
  };
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (event, gesture) => event.nativeEvent.touches.length > 1 || Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5,
    onMoveShouldSetPanResponder: (event, gesture) => event.nativeEvent.touches.length > 1 || Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5,
    onPanResponderGrant: event => {
      mapRef.current?.measureInWindow((x, y) => { mapOriginRef.current = [x, y]; });
      const touches = event.nativeEvent.touches;
      const currentOffset = offsetRef.current;
      const currentZoom = zoomRef.current;
      if (touches.length > 1) {
        const [first, second] = touches;
        const focalX = ((first.pageX + second.pageX) / 2) - mapOriginRef.current[0] - width / 2;
        const focalY = ((first.pageY + second.pageY) / 2) - mapOriginRef.current[1] - 150;
        gestureRef.current = { mode: 'pinch', baseZoom: currentZoom, baseOffset: currentOffset, baseDx: 0, baseDy: 0,
          distance: Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY), focalX, focalY };
      } else {
        gestureRef.current = { mode: 'pan', baseZoom: currentZoom, baseOffset: currentOffset, baseDx: 0, baseDy: 0, distance: 0, focalX: 0, focalY: 0 };
      }
    },
    onPanResponderMove: (event, gesture) => {
      const touches = event.nativeEvent.touches;
      let state = gestureRef.current;
      if (touches.length > 1) {
        const [first, second] = touches;
        const focalX = ((first.pageX + second.pageX) / 2) - mapOriginRef.current[0] - width / 2;
        const focalY = ((first.pageY + second.pageY) / 2) - mapOriginRef.current[1] - 150;
        const distance = Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
        if (!state || state.mode !== 'pinch') {
          state = { mode: 'pinch', baseZoom: zoomRef.current, baseOffset: offsetRef.current, baseDx: gesture.dx, baseDy: gesture.dy, distance, focalX, focalY };
          gestureRef.current = state;
          return;
        }
        const nextZoom = Math.max(1, Math.min(19, cameraZoomRef.current + state.baseZoom + Math.log2(Math.max(distance, 1) / Math.max(state.distance, 1)))) - cameraZoomRef.current;
        const scale = 2 ** (nextZoom - state.baseZoom);
        updateView(nextZoom, [(state.focalX + state.baseOffset[0]) * scale - focalX, (state.focalY + state.baseOffset[1]) * scale - focalY]);
        return;
      }
      if (!state || state.mode !== 'pan') {
        state = { mode: 'pan', baseZoom: zoomRef.current, baseOffset: offsetRef.current, baseDx: gesture.dx, baseDy: gesture.dy, distance: 0, focalX: 0, focalY: 0 };
        gestureRef.current = state;
        return;
      }
      updateView(state.baseZoom, [state.baseOffset[0] - (gesture.dx - state.baseDx), state.baseOffset[1] - (gesture.dy - state.baseDy)]);
    },
    onPanResponderRelease: () => { gestureRef.current = null; },
    onPanResponderTerminate: () => { gestureRef.current = null; },
    onPanResponderTerminationRequest: () => false,
  }), [width]);
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
  cameraZoomRef.current = camera.zoom;
  if (!data) return <View style={styles.panel}>
    <Text style={styles.title}>Dein Revier</Text>
    {loading ? <ActivityIndicator color="#fc7a3d" /> : null}
    {error ? <Text style={styles.copy}>{error}</Text> : null}
    {!loading && onRetry ? <Pressable onPress={onRetry} accessibilityRole="button"><Text style={styles.retry}>Erneut laden</Text></Pressable> : null}
  </View>;
  const zoom = Math.max(1, Math.min(19, camera.zoom + zoomDelta));
  const tileZoom = Math.floor(zoom);
  const tileScale = 2 ** (zoom - tileZoom);
  const scale = 256 * 2 ** zoom;
  const cx = camera.center[0] * scale + offset[0], cy = camera.center[1] * scale + offset[1];
  const left = cx - width / 2, top = cy - 150;
  const tiles: Array<{ x: number; y: number }> = [];
  for (let x = Math.floor(left / (256 * tileScale)); x <= Math.floor((left + width) / (256 * tileScale)); x++) {
    for (let y = Math.floor(top / (256 * tileScale)); y <= Math.floor((top + 300) / (256 * tileScale)); y++) {
      if (x >= 0 && y >= 0 && x < 2 ** tileZoom && y < 2 ** tileZoom) tiles.push({ x, y });
    }
  }
  const selected = data.territories.find(t => t.id === selectedId);
  const changeZoom = (delta: number) => { const nextZoom = Math.max(1, Math.min(19, zoom + delta)); const ratio = 2 ** (nextZoom - zoom); updateView(nextZoom - camera.zoom, [offset[0] * ratio, offset[1] * ratio]); };
  return <View style={styles.panel}>
    <Text style={styles.title}>Dein Revier</Text>
    {error ? <View style={styles.error}><Text style={styles.copy}>{error}</Text>{onRetry ? <Pressable onPress={onRetry} accessibilityRole="button"><Text style={styles.retry}>Erneut laden</Text></Pressable> : null}</View> : null}
    <Text style={styles.area}>{km2(data.myAreaM2)}</Text>
    <Text style={styles.copy}>{data.season.key} · bis {new Date(new Date(data.season.end).getTime() - 1).toLocaleDateString('de-DE')} · Orange: du · Blau: andere</Text>
    <View ref={mapRef} {...panResponder.panHandlers} onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.map} accessibilityLabel="Revierkarte. Mit einem Finger verschieben, mit zwei Fingern zoomen.">
      {tiles.map(tile => <Image alt="" key={`${tileZoom}:${tile.x}:${tile.y}`} source={{ uri: `https://tile.openstreetmap.org/${tileZoom}/${tile.x}/${tile.y}.png` }} style={{ position: 'absolute', left: tile.x * 256 * tileScale - left, top: tile.y * 256 * tileScale - top, width: 256 * tileScale, height: 256 * tileScale }} onError={() => setTileError(true)} />)}
      <Svg width={width} height={300} accessibilityLabel="Revierkarte mit auswählbaren Gebieten">
        {data.territories.map(t => {
          const polygons = t.geometry.type === 'Polygon' ? [t.geometry.coordinates] : t.geometry.coordinates;
          const d = polygons.map(rings => rings.map(ring => ring.map((p, i) => { const [x, y] = project(p); return `${i ? 'L' : 'M'}${(x * scale - left).toFixed(2)},${(y * scale - top).toFixed(2)}`; }).join(' ') + ' Z').join(' ')).join(' ');
          const color = t.mine ? '#f97316' : '#38bdf8';
          return <Path key={t.id} d={d} fill={color} fillOpacity={0.3} stroke={selectedId === t.id ? '#fff' : color} strokeWidth={2} fillRule="evenodd" onPress={() => setSelectedId(t.id)} accessibilityLabel={`Gebiet von ${t.ownerName}, ${km2(t.areaM2)}`} />;
        })}
      </Svg>
    </View>
    <View style={styles.controls}>{[['＋', () => changeZoom(1)], ['−', () => changeZoom(-1)], ['Alle', () => updateView(0, [0, 0])]].map(([label, action]) => <Pressable key={String(label)} accessibilityRole="button" accessibilityLabel={String(label)} onPress={action as () => void} style={styles.button}><Text style={styles.text}>{String(label)}</Text></Pressable>)}</View>
    <Pressable onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')}><Text style={styles.copy}>© OpenStreetMap-Mitwirkende</Text></Pressable>
    {tileError ? <Text style={styles.copy}>Hintergrundkarte nicht verfügbar. Gebiete werden weiterhin angezeigt.</Text> : null}
    {selected ? <View><Text style={styles.text}>{selected.ownerName} · {km2(selected.areaM2)}</Text><Text style={styles.copy}>{selected.lastActivityName} · Eingenommen: {new Date(selected.capturedAt).toLocaleString('de-DE')}</Text>{selected.history.map((e, i) => <Text key={i} style={styles.copy}>{e.fromName ?? 'Freie Fläche'} → {e.toName}</Text>)}</View> : null}
    {!data.territories.length ? <Text style={styles.copy}>Noch freie Karte: Nimm mit deinem nächsten Rundlauf das erste Gebiet ein.</Text> : null}
    <Text style={styles.heading}>Flächenrangliste</Text>
    {data.leaderboard.map((entry, i) => <Text key={entry.userId} style={styles.text}>{i + 1}. {entry.name} · {km2(entry.areaM2)}</Text>)}
    <Text style={styles.heading}>Deine letzten Läufe</Text>
    {data.myRuns.map(run => <View key={run.id}><Text style={styles.text}>{run.name}</Text><Text style={styles.copy}>{run.message}</Text></View>)}
    <Pressable onPress={() => setRules(value => !value)} accessibilityRole="button"><Text style={styles.heading}>{rules ? 'Regeln schließen' : 'So funktioniert die Eroberung'}</Text></Pressable>
    {rules ? <Text style={styles.copy}>Outdoor-Läufe und Trailruns ab Saisonstart zählen. Start und Ziel: 100 m Grundtoleranz; bei längeren Läufen bis 10 % der Strecke, maximal 300 m. Kreuzungen und gemeinsam gelaufene Hin-/Rückwege sind erlaubt. Es zählen eingeschlossene Teilflächen ab 10.000 m²; schmale GPS-Streifen und GPS-Lücken zählen nicht. Private, manuelle und Indoor-Aktivitäten zählen nicht. Fremde Gebiete musst du vollständig umlaufen (10 m GPS-Toleranz); teilweise Überschneidungen ändern deren Besitz nicht. Freie Flächen gehören dir, eigene Flächen zählen nur einmal. Der Laufabschluss entscheidet, bei gleicher Zeit die Aktivitäts-ID. Läufe über Saisongrenzen zählen nicht. Jedes Quartal beginnt eine neue Saison. Strava-Änderungen und Löschungen werden täglich geprüft. Zum Aktualisieren die Arena nach unten ziehen.</Text> : null}
    <Text style={styles.heading}>Letzte Gebietswechsel</Text>
    {data.events.slice(0, 10).map((e, i) => <Text key={`${e.claimId}:${e.territoryId}:${i}`} style={styles.copy}>{e.toName} {e.fromName ? `erobert von ${e.fromName}` : 'nimmt freie Fläche ein'} · {km2(e.areaM2)}</Text>)}
  </View>;
}
const styles = StyleSheet.create({
  panel: { borderRadius: 20, borderWidth: 1, borderColor: '#7c2d12', backgroundColor: '#18181b', padding: 16, gap: 10 },
  error: { gap: 5, borderWidth: 1, borderColor: '#3f3f46', borderRadius: 14, padding: 12, backgroundColor: '#202024' },
  retry: { color: '#fb923c', fontSize: 12, fontWeight: '900' },
  title: { color: '#fafafa', fontSize: 24, fontWeight: '900' }, area: { color: '#fb923c', fontSize: 28, fontWeight: '900' },
  heading: { color: '#fafafa', fontSize: 14, fontWeight: '800', marginTop: 8 }, text: { color: '#fafafa', fontSize: 12 }, copy: { color: '#a1a1aa', fontSize: 11, lineHeight: 17 },
  map: { overflow: 'hidden', height: 300, backgroundColor: '#27272a', borderRadius: 12 }, controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  button: { backgroundColor: '#3f3f46', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
});
