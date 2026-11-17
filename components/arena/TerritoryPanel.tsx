'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TerritoryData } from '@/lib/territory/types';

const TerritoryMap = dynamic(() => import('./TerritoryMap'), { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-2xl bg-zinc-900" aria-label="Karte wird geladen" /> });
const km2 = (value: number) => `${(value / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 3 })} km²`;

export function TerritoryPanel() {
  const [data, setData] = useState<TerritoryData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const inFlight = useRef<{ signal?: AbortSignal } | null>(null);
  const retryAt = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (signal?: AbortSignal) => {
    if ((inFlight.current && !inFlight.current.signal?.aborted) || Date.now() < retryAt.current) return;
    const request = { signal };
    inFlight.current = request;
    await fetch('/api/arena/territories', { cache: 'no-store', signal }).then(async response => {
      if (response.status === 401) { setAnonymous(true); return; }
      if (response.status === 503) {
        const seconds = Number(response.headers.get('Retry-After'));
        if (Number.isFinite(seconds) && seconds > 0) retryAt.current = Date.now() + seconds * 1000;
        throw new Error('Die Revierkarte ist gerade nicht verfügbar. Bitte später erneut versuchen.');
      }
      if (!response.ok) throw new Error('Das Revier konnte nicht geladen werden.');
      const payload = await response.json();
      if (!signal?.aborted) { setData(payload); setError(null); }
    }).catch(err => {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : 'Revier nicht verfügbar.');
    }).finally(() => { if (inFlight.current === request) inFlight.current = null; if (!signal?.aborted) setLoading(false); });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const refresh = () => { setRefreshing(true); void load().finally(() => setRefreshing(false)); };
  const selected = data?.territories.find(t => t.id === selectedId);
  return <section id="revier" className="space-y-5 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-orange-400">Lauf um dein Revier</p><h2 className="mt-1 text-3xl font-black">Revier</h2><p className="mt-2 text-sm text-zinc-400">Runde schließen. Fläche einnehmen. Fremde Gebiete vollständig umlaufen.</p></div>{data ? <div><p className="text-xs text-zinc-400">Deine Fläche · {data.season.key}</p><p className="text-3xl font-black text-orange-400">{km2(data.myAreaM2)}</p></div> : null}</div>
    {loading ? <p role="status">Revier wird geladen …</p> : null}
    {anonymous ? <a href="/api/auth/strava/login" className="inline-block rounded-xl bg-orange-600 px-5 py-3 font-bold">Mit Strava anmelden und Revier entdecken</a> : null}
    {error ? <div role="alert" className="text-red-300">{error} <button onClick={() => void load()} className="underline">Erneut versuchen</button></div> : null}
    {data ? <>
      <button onClick={refresh} disabled={refreshing} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm disabled:opacity-50">{refreshing ? 'Wird aktualisiert …' : 'Revier aktualisieren'}</button>
      <p className="text-xs text-zinc-400">Saison: {new Date(data.season.start).toLocaleDateString('de-DE')} bis {new Date(new Date(data.season.end).getTime() - 1).toLocaleDateString('de-DE')} · Orange: du · Blau: andere Mitglieder</p>
      <TerritoryMap territories={data.territories} onSelect={setSelectedId} />
      {!data.territories.length ? <p className="text-sm text-zinc-400">Die Karte ist noch frei. Dein nächster gültiger Rundlauf kann das erste Revier einnehmen.</p> : null}
      {selected ? <div aria-live="polite" className="rounded-2xl bg-zinc-800 p-4"><div className="flex justify-between gap-3"><h3 className="font-bold">Gebiet von {selected.ownerName}</h3><button aria-label="Gebietsdetails schließen" onClick={() => setSelectedId(null)}>Schließen</button></div><p>{selected.lastActivityName} · {km2(selected.areaM2)} · Eingenommen am {new Date(selected.capturedAt).toLocaleString('de-DE')}</p><p className="mt-2 text-xs text-zinc-400">{selected.history.map(e => `${e.fromName ?? 'Freie Fläche'} → ${e.toName}`).join(' · ') || 'In dieser Saison eingenommen.'}</p></div> : null}
      <div className="grid gap-6 md:grid-cols-2"><div><h3 className="mb-3 font-bold">Flächenrangliste</h3>{data.leaderboard.length ? <ol className="space-y-2">{data.leaderboard.map((entry, i) => <li key={entry.userId} className="flex justify-between gap-3 text-sm"><span>{i + 1}. {entry.name}</span><span className="font-mono text-orange-300">{km2(entry.areaM2)}</span></li>)}</ol> : <p className="text-sm text-zinc-500">Noch keine Gebiete vergeben.</p>}</div><div><h3 className="mb-3 font-bold">Deine letzten Läufe</h3><ul className="space-y-3">{data.myRuns.map(run => <li key={run.id}><p className="text-sm font-semibold">{run.name}</p><p className="text-xs text-zinc-400">{run.message}</p></li>)}</ul>{!data.myRuns.length ? <p className="text-sm text-zinc-500">Noch keine Läufe in dieser Saison.</p> : null}</div></div>
      <details className="text-sm text-zinc-400"><summary className="cursor-pointer font-bold text-zinc-200">So funktioniert die Eroberung</summary><p className="mt-3">Outdoor-Läufe und Trailruns zählen ab Saisonstart. Start und Ziel dürfen grundsätzlich 100 Meter auseinanderliegen; bei längeren Läufen gelten bis zu 10 % der Strecke, maximal 300 Meter. Kreuzungen und gemeinsam gelaufene Hin-/Rückwege sind erlaubt. Es zählen die tatsächlich eingeschlossenen Teilflächen ab 10.000 m²; schmale GPS-Streifen werden ausgefiltert. Unvollständige, private, manuelle und Indoor-Aktivitäten zählen nicht.</p><p className="mt-2">Fremde Gebiete werden nur vollständig übernommen, mit 10 Metern GPS-Toleranz. Bei teilweisen Überschneidungen bleibt der bisherige Besitz erhalten. Freie Flächen deiner Runde gehören dir. Bereits eigene Flächen zählen nicht doppelt. Der Laufabschluss entscheidet; bei exakt gleicher Zeit entscheidet die stabile Aktivitäts-ID. Läufe über eine Saisongrenze zählen nicht.</p><p className="mt-2">Jedes Quartal startet eine neue Saison. Änderungen und entfernte Strava-Aktivitäten werden täglich nachgeprüft; dadurch können sich Besitzstände nachträglich ändern. Die Karte lädt beim Öffnen. Mit „Revier aktualisieren“ holst du den neuesten Stand. Kartendaten: OpenStreetMap.</p></details>
      <details className="text-sm"><summary className="cursor-pointer font-bold">Letzte Gebietswechsel</summary><ul className="mt-3 space-y-2 text-zinc-400">{data.events.map((event, i) => <li key={`${event.claimId}:${event.territoryId}:${i}`}>{event.fromName ? `${event.toName} erobert von ${event.fromName}` : `${event.toName} nimmt freie Fläche ein`} · {km2(event.areaM2)}</li>)}</ul></details>
    </> : null}
  </section>;
}
