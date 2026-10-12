'use client';

import { useState } from 'react';
import type { FitnessHistoryPoint } from '@/lib/training/history';

export function FitnessHistory({ points }: { points: FitnessHistoryPoint[] }) {
  const [metric, setMetric] = useState<'vdot' | 'vo2max'>('vdot');
  const getValue = (point: FitnessHistoryPoint) => metric === 'vdot' ? point.vdot : point.vo2max.value;
  const label = metric === 'vdot' ? 'VDOT' : 'VO₂max-Schätzung';
  const valid = points.filter(p => getValue(p) !== null);
  const values = valid.map(p => getValue(p) as number);
  const low = Math.min(...values, 25) - 2;
  const high = Math.max(...values, 35) + 2;
  const y = (value: number) => 105 - (value - low) / (high - low) * 90;
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-5">
      <h3 className="text-xl font-black text-white">Deine Entwicklung · 26 Wochen</h3>
      <p className="text-xs text-zinc-400">Wöchentlich aus den jeweils vorhergehenden 12 Wochen rekonstruiert. VDOT ist ein Leistungsindex, keine gemessene VO₂max. Mindestens vier geeignete Läufe sind erforderlich. Historische manuelle VDOT- und Maximalpuls-Vorgaben sind nicht gespeichert und werden hier nicht rückwirkend angenommen.</p>
      <div className="flex gap-2" role="group" aria-label="Verlauf auswählen">
        {(['vdot', 'vo2max'] as const).map(key => <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)} className={`rounded-xl px-4 py-2 text-xs font-bold cursor-pointer ${metric === key ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-300'}`}>{key === 'vdot' ? 'VDOT' : 'VO₂max-Schätzung'}</button>)}
      </div>
      {metric === 'vo2max' ? <p className="text-xs text-zinc-400">VO₂max in ml/kg/min: geglättet über sechs Wochen, mindestens drei geeignete Läufe an unterschiedlichen Tagen. Frühere manuelle Maximalpuls-Vorgaben sind unbekannt; der Verlauf bleibt eine grobe Rekonstruktion.</p> : null}
      {valid.length > 1 ? (
        <svg viewBox="0 0 520 125" role="img" aria-label={`${label}: Verlauf der letzten 26 Wochen`} className="w-full h-40">
          {points.slice(1).map((point, i) => getValue(point) !== null && getValue(points[i]) !== null ? <line key={point.date} x1={10 + i * 20} y1={y(getValue(points[i]) as number)} x2={30 + i * 20} y2={y(getValue(point) as number)} stroke="#fb923c" strokeWidth="2" /> : null)}
          {points.map((point, i) => getValue(point) !== null ? <circle key={point.date} cx={10 + i * 20} cy={y(getValue(point) as number)} r="3" fill="#fb923c"><title>{new Date(point.date).toLocaleDateString('de-DE')}: {label} {getValue(point)}</title></circle> : null)}
        </svg>
      ) : <p className="text-sm text-zinc-400">Für einen Verlauf fehlen noch ausreichend Wochen mit Laufdaten.</p>}
      {valid.length > 1 ? <p className="text-xs text-orange-400">{label} {getValue(valid[0])} → {getValue(valid[valid.length - 1])} · {new Date(valid[0].date).toLocaleDateString('de-DE')} bis {new Date(valid[valid.length - 1].date).toLocaleDateString('de-DE')}</p> : null}
      <div className="overflow-x-auto max-h-96 rounded-xl border border-zinc-800">
        <table className="w-full text-xs text-left whitespace-nowrap">
          <caption className="sr-only">Wöchentliche Fitness-, Belastungs- und Körperwerte. Details zeigen alle Trainingspaces und Pulszonen.</caption>
          <thead className="text-zinc-400 bg-zinc-950"><tr>{['Datum', 'VDOT auto', 'VO₂max¹', 'Ø km/Woche', 'ACWR', 'HRmax*', 'Ruhepuls', 'Gewicht', 'Paces & Zonen'].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-zinc-800 text-zinc-300">
            {[...points].reverse().map(point => (
              <tr key={point.date}>
                <th scope="row" className="p-3">{new Date(point.date).toLocaleDateString('de-DE')}</th>
                <td className="p-3 text-orange-400 font-bold">{point.vdot ?? '—'}</td>
                <td className="p-3 text-cyan-400" title={point.vo2max.reason}>{point.vo2max.value ?? '—'}</td>
                <td className="p-3">{point.baseline.runCount ? point.baseline.averageWeeklyKm : '—'}</td>
                <td className="p-3">{point.baseline.runCount ? point.baseline.acwr : '—'}</td>
                <td className="p-3" title={point.maxHrSource}>{point.maxHr}</td>
                <td className="p-3">{point.restingHeartrate ?? '—'}</td>
                <td className="p-3">{point.weightKg ?? '—'}</td>
                <td className="p-3"><details><summary className="cursor-pointer text-orange-400">Anzeigen</summary><div className="py-2 space-y-1">
                  {point.paces ? <><p>Easy: {point.paces.easyMin}–{point.paces.easyMax}</p><p>Marathon: {point.paces.marathonMin}–{point.paces.marathonMax}</p><p>Schwelle: {point.paces.thresholdMin}–{point.paces.thresholdMax}</p><p>Intervall: {point.paces.intervalMin}–{point.paces.intervalMax}</p><p>Wiederholung: {point.paces.repetitionMin}–{point.paces.repetitionMax} min/km</p></> : <p>Zu wenige Läufe für Trainingspaces.</p>}
                  {point.zones.map(zone => <p key={zone.zone}>Zone {zone.zone}: {zone.minHr}–{zone.maxHr} bpm</p>)}
                  <p>VO₂max: {point.vo2max.sampleCount} geeignete Läufe / 6 Wochen · {point.vo2max.quality === 'insufficient' ? 'unzureichende' : 'begrenzte'} Datenqualität</p>
                  <p>{point.vo2max.reason}</p>
                  <p>{point.maxHrSource}; {point.baseline.fitnessSampleCount} geeignete Läufe / 12 Wochen</p>
                </div></details></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">¹ VO₂max in ml/kg/min, eigenständige Modellschätzung aus Pace und Puls. * Höchster aufgezeichneter Laufpuls im Zeitfenster, sonst 185 bpm als Annahme; kein Nachweis des tatsächlichen Maximalpulses. Gewicht und Ruhepuls: letzter erfasster Wert bis zum jeweiligen Datum. Paces und Zonen sind automatisch rekonstruiert und können von damaligen manuellen Einstellungen abweichen.</p>
    </section>
  );
}
