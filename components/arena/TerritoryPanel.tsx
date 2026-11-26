'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { describeChange, formatArea, type TerritoryData } from '@/lib/territory/types';

const TerritoryMap = dynamic(() => import('./TerritoryMap'), { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-2xl bg-zinc-900" aria-label="Karte wird geladen" /> });
const km2 = formatArea;

const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function TerritoryPanel({ userId }: { userId: string | null }) {
  const [data, setData] = useState<TerritoryData | null>(null);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [stale, setStale] = useState(false);
  const inFlight = useRef<{ signal?: AbortSignal } | null>(null);
  const retryAt = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allRanks, setAllRanks] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!userId) return;
    if ((inFlight.current && !inFlight.current.signal?.aborted) || Date.now() < retryAt.current) return;
    const request = { signal };
    inFlight.current = request;
    await fetch('/api/arena/territories', { cache: 'no-store', signal }).then(async response => {
      if (response.status === 401) {
        if (!signal?.aborted) {
          setAnonymous(true); setData(null); setDataOwnerId(null); setStale(false);
          try { localStorage.removeItem(`dorfduesen:territory:v1:${userId}`); } catch { /* Storage can be unavailable. */ }
        }
        return;
      }
      if (response.status === 503) {
        const seconds = Number(response.headers.get('Retry-After'));
        if (Number.isFinite(seconds) && seconds > 0) retryAt.current = Date.now() + seconds * 1000;
        throw new Error('Die Revierkarte ist gerade nicht verfügbar. Bitte später erneut versuchen.');
      }
      if (!response.ok) throw new Error('Das Revier konnte nicht geladen werden.');
      const payload = await response.json() as TerritoryData;
      if (!signal?.aborted) {
        setData(payload); setDataOwnerId(userId); setStale(false); setError(null);
        try { localStorage.setItem(`dorfduesen:territory:v1:${userId}`, JSON.stringify({ savedAt: Date.now(), data: payload })); } catch { /* Storage can be unavailable or full. */ }
      }
    }).catch(err => {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : 'Revier nicht verfügbar.');
    }).finally(() => { if (inFlight.current === request) inFlight.current = null; if (!signal?.aborted) setLoading(false); });
  }, [userId]);
  useEffect(() => {
    setError(null);
    setAnonymous(false);
    setSelectedId(null);
    setData(null);
    setDataOwnerId(null);
    setStale(false);
    retryAt.current = 0;
    if (!userId) {
      setAnonymous(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const raw = localStorage.getItem(`dorfduesen:territory:v1:${userId}`);
      if (raw) {
        const cached = JSON.parse(raw) as { savedAt?: number; data?: TerritoryData };
        if (cached.savedAt && Date.now() - cached.savedAt < CACHE_MAX_AGE_MS && cached.data) {
          setData(cached.data);
          setDataOwnerId(userId);
          setStale(true);
          setLoading(false);
        }
      }
    } catch { /* Ignore malformed or unavailable local cache. */ }
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, userId]);
  const refresh = () => { setRefreshing(true); void load().finally(() => setRefreshing(false)); };
  const visibleData = userId && dataOwnerId === userId ? data : null;
  const selected = visibleData?.territories.find(t => t.id === selectedId);
  const myRankIndex = visibleData?.leaderboard.findIndex(entry => entry.userId === userId) ?? -1;
  const ranks = visibleData ? (allRanks ? visibleData.leaderboard : visibleData.leaderboard.slice(0, 3)) : [];
  // Locally cached payloads from before the aggregated change list have no `changes`.
  const changes = visibleData?.changes ?? [];
  const rankRow = (entry: TerritoryData['leaderboard'][number], i: number) => <li key={entry.userId} className={`flex justify-between gap-3 text-sm ${entry.userId === userId ? 'font-bold text-orange-300' : ''}`}><span>{i + 1}. {entry.name}</span><span className="font-mono text-orange-300">{km2(entry.areaM2)}</span></li>;
  return <section id="revier" className="space-y-5 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-orange-400">Lauf um dein Revier</p><h2 className="mt-1 text-3xl font-black">Revier</h2><p className="mt-2 text-sm text-zinc-400">Runde schließen. Fläche einnehmen. Fremde Gebiete vollständig umlaufen.</p></div>{visibleData ? <div><p className="text-xs text-zinc-400">Deine Fläche · {visibleData.season.key}</p><p className="text-3xl font-black text-orange-400">{km2(visibleData.myAreaM2)}</p></div> : null}</div>
    {loading ? <p role="status">Revier wird geladen …</p> : null}
    {stale && visibleData ? <p role="status" className="text-xs text-zinc-400">Gespeicherter Revierstand · wird im Hintergrund aktualisiert.</p> : null}
    {anonymous ? <a href="/api/auth/strava/login" className="inline-block rounded-xl bg-orange-600 px-5 py-3 font-bold">Mit Strava anmelden und Revier entdecken</a> : null}
    {error ? <div role="alert" className="text-red-300">{error} <button onClick={() => void load()} className="underline">Erneut versuchen</button></div> : null}
    {visibleData ? <>
      <button onClick={refresh} disabled={refreshing} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm disabled:opacity-50">{refreshing ? 'Wird aktualisiert …' : 'Revier aktualisieren'}</button>
      <p className="text-xs text-zinc-400">Saison: {new Date(visibleData.season.start).toLocaleDateString('de-DE')} bis {new Date(new Date(visibleData.season.end).getTime() - 1).toLocaleDateString('de-DE')} · Orange: du · Blau: andere Mitglieder</p>
      <TerritoryMap territories={visibleData.territories} onSelect={setSelectedId} />
      {!visibleData.territories.length ? <p className="text-sm text-zinc-400">Die Karte ist noch frei. Dein nächster gültiger Rundlauf kann das erste Revier einnehmen.</p> : null}
      {selected ? <div aria-live="polite" className="rounded-2xl bg-zinc-800 p-4"><div className="flex justify-between gap-3"><h3 className="font-bold">{selected.ownerNames?.length > 1 ? 'Gemeinsames Revier' : `Gebiet von ${selected.ownerName}`}</h3><button aria-label="Gebietsdetails schließen" onClick={() => setSelectedId(null)}>Schließen</button></div><p>{selected.lastActivityName} · {km2(selected.areaM2)} · Eingenommen am {new Date(selected.capturedAt).toLocaleString('de-DE')}</p>{selected.ownerNames?.length > 1 ? <p className="mt-1 text-sm">{selected.ownerNames.join(', ')}</p> : null}<p className="mt-2 text-xs text-zinc-400">{selected.history.slice(-5).map(e => `${e.fromName ?? 'Freie Fläche'} → ${e.toName}`).join(' · ') || 'In dieser Saison eingenommen.'}</p></div> : null}
      <div><h3 className="mb-3 font-bold">Flächenrangliste</h3>{visibleData.leaderboard.length ? <ol className="space-y-2">{ranks.map(rankRow)}{!allRanks && myRankIndex >= 3 ? rankRow(visibleData.leaderboard[myRankIndex], myRankIndex) : null}</ol> : <p className="text-sm text-zinc-500">Noch keine Gebiete vergeben.</p>}{visibleData.leaderboard.length > 3 ? <button onClick={() => setAllRanks(value => !value)} aria-expanded={allRanks} className="mt-3 text-sm font-bold text-orange-400">{allRanks ? 'Weniger anzeigen ▴' : `Alle ${visibleData.leaderboard.length} anzeigen ▾`}</button> : null}</div>
      <details className="text-sm text-zinc-400"><summary className="cursor-pointer font-bold text-zinc-200">So funktioniert die Eroberung</summary><p className="mt-3">Outdoor-Läufe und Trailruns zählen ab Saisonstart. Start und Ziel dürfen grundsätzlich 100 Meter auseinanderliegen; bei längeren Läufen gelten bis zu 10 % der Strecke, maximal 300 Meter. Kreuzungen und gemeinsam gelaufene Hin-/Rückwege sind erlaubt. Es zählen die tatsächlich eingeschlossenen Teilflächen ab 10.000 m²; schmale GPS-Streifen und Reststücke unter 2.000 m² werden ausgefiltert. Unvollständige, private, manuelle und Indoor-Aktivitäten zählen nicht.</p><p className="mt-2">Fremde Gebiete werden nur vollständig übernommen, mit 10 Metern GPS-Toleranz. Bei teilweisen Überschneidungen bleibt der bisherige Besitz erhalten. Freie Flächen deiner Runde gehören dir. Bereits eigene Flächen zählen nicht doppelt. Gruppenläufe: Wer mit anderen dieselbe Runde zur selben Zeit läuft (Start und Ziel höchstens 15 Minuten auseinander, mindestens 70 % gleiche Fläche), erobert nichts voneinander. Das Gebiet gehört allen gemeinsam und zählt für jeden in der Rangliste. Der Laufabschluss entscheidet; bei exakt gleicher Zeit entscheidet die stabile Aktivitäts-ID. Läufe über eine Saisongrenze zählen nicht.</p><p className="mt-2">Jedes Quartal startet eine neue Saison. Änderungen und entfernte Strava-Aktivitäten werden täglich nachgeprüft; dadurch können sich Besitzstände nachträglich ändern. Die Karte lädt beim Öffnen. Mit „Revier aktualisieren“ holst du den neuesten Stand. Kartendaten: OpenStreetMap.</p></details>
      {changes.length ? <details className="text-sm"><summary className="cursor-pointer font-bold">Letzte Gebietswechsel</summary><ul className="mt-3 space-y-2 text-zinc-400">{changes.map(change => <li key={change.id}>{describeChange(change)}</li>)}</ul></details> : null}
    </> : null}
  </section>;
}
