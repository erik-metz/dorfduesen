'use client';

import { useState } from 'react';
import type { FitnessHistoryPoint } from '@/lib/training/history';
import { continuousSegments, formatHistoryValue, HISTORY_METRICS, historySeries, type HistoryMetric } from '@/lib/training/history-series';

const WIDTH = 760;
const HEIGHT = 280;
const LEFT = 65;
const RIGHT = 20;
const TOP = 24;
const BOTTOM = 40;
const dateLabel = (date: string) => new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

export function FitnessHistory({ points }: { points: FitnessHistoryPoint[] }) {
  const [metric, setMetric] = useState<HistoryMetric>('vdot');
  const [hidden, setHidden] = useState<string[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const series = historySeries(points, metric);
  const visible = series.filter(item => !hidden.includes(item.id));
  const values = visible.flatMap(item => item.values.flatMap(value => value ? [value.min, value.max] : []));
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 1;
  const padding = Math.max((maximum - minimum) * 0.1, metric === 'acwr' ? 0.1 : 1);
  const low = Math.max(0, minimum - padding);
  const high = maximum + padding;
  const x = (index: number) => LEFT + index / Math.max(points.length - 1, 1) * (WIDTH - LEFT - RIGHT);
  const y = (value: number) => TOP + (metric === 'paces' ? (value - low) / (high - low) : (high - value) / (high - low)) * (HEIGHT - TOP - BOTTOM);
  const activeIndex = Math.min(selected ?? points.length - 1, points.length - 1);
  const active = points[activeIndex];
  const { label, unit } = HISTORY_METRICS[metric];
  const changeMetric = (next: HistoryMetric) => { setMetric(next); setHidden([]); };
  const rangeLabel = (value: { min: number; max: number } | null) => value ? `${formatHistoryValue(value.min, metric)}${value.min === value.max ? '' : `–${formatHistoryValue(value.max, metric)}`} ${unit}` : 'Keine ausreichenden Daten';

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-8 space-y-5">
      <div>
        <h3 className="text-xl font-black text-white">Deine Entwicklung · 26 Wochen</h3>
        <p className="text-xs text-zinc-400 mt-2">Wähle eine Messreihe und vergleiche ihre Entwicklung. Die Werte sind aus den damals verfügbaren Aktivitäten rekonstruiert.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Messreihe auswählen">
        {(['vdot', 'vo2max', 'paces', 'zones'] as const).map(key => <button key={key} type="button" aria-pressed={metric === key} onClick={() => changeMetric(key)} className={`rounded-xl px-4 py-2.5 text-xs font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-orange-400 ${metric === key ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>{HISTORY_METRICS[key].label}</button>)}
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="sr-only">Weitere Messreihen</span>
          <select aria-label="Weitere Messreihen" value={['vdot', 'vo2max', 'paces', 'zones'].includes(metric) ? '' : metric} onChange={event => changeMetric(event.target.value as HistoryMetric)} className="rounded-xl bg-zinc-800 px-3 py-2.5 text-zinc-200 cursor-pointer">
            <option value="" disabled>Weitere Messreihen</option>
            {(['volume', 'acwr', 'maxHr', 'restingHr', 'weight'] as const).map(key => <option key={key} value={key}>{HISTORY_METRICS[key].label}</option>)}
          </select>
        </label>
      </div>
      <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-3 sm:p-5 space-y-3">
        <div className="flex flex-wrap justify-between gap-2">
          <h4 className="font-bold text-white text-sm">{label} <span className="font-normal text-zinc-500">· {unit}</span></h4>
          {metric === 'paces' ? <span className="text-xs text-zinc-400">Schnelleres Tempo steht weiter oben</span> : null}
        </div>
        {series.length > 1 ? <div className="flex flex-wrap gap-2" role="group" aria-label="Linien ein- oder ausblenden">
          {series.map(item => <button key={item.id} type="button" aria-pressed={!hidden.includes(item.id)} onClick={() => setHidden(previous => previous.includes(item.id) ? previous.filter(id => id !== item.id) : [...previous, item.id])} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-pointer ${hidden.includes(item.id) ? 'border-zinc-800 text-zinc-500' : 'border-zinc-700 text-zinc-200'}`}><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</button>)}
        </div> : null}
        {values.length ? <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${label}: Verlauf mit Datumsachse und ${unit}-Skala. Wähle darunter eine Woche für die genauen Werte.`} className="w-full min-w-[480px] h-auto">
            {Array.from({ length: 5 }, (_, index) => {
              const value = low + (high - low) * index / 4;
              return <g key={index}><line x1={LEFT} x2={WIDTH - RIGHT} y1={y(value)} y2={y(value)} stroke="#27272a" /><text x={LEFT - 10} y={y(value) + 4} textAnchor="end" fill="#a1a1aa" fontSize="11">{formatHistoryValue(value, metric)}</text></g>;
            })}
            {points.filter((_, index) => index % 5 === 0 || index === points.length - 1).map(point => {
              const index = points.indexOf(point);
              return <text key={point.date} x={x(index)} y={HEIGHT - 12} textAnchor="middle" fill="#a1a1aa" fontSize="11">{dateLabel(point.date)}</text>;
            })}
            {visible.map(item => <g key={item.id}>
              {continuousSegments(item.values).map(segment => {
                const lower = segment.map(index => `${x(index)},${y(item.values[index]!.min)}`).join(' ');
                const upper = [...segment].reverse().map(index => `${x(index)},${y(item.values[index]!.max)}`).join(' ');
                return <g key={segment[0]}>
                  <polygon points={`${lower} ${upper}`} fill={item.color} fillOpacity="0.14" />
                  <polyline points={lower} fill="none" stroke={item.color} strokeWidth="2" />
                  <polyline points={[...segment].map(index => `${x(index)},${y(item.values[index]!.max)}`).join(' ')} fill="none" stroke={item.color} strokeWidth="1" strokeOpacity="0.6" />
                  {segment.map(index => <circle key={index} cx={x(index)} cy={y(item.values[index]!.min)} r="2.5" fill={item.color}><title>{`${dateLabel(points[index].date)} · ${item.label}: ${rangeLabel(item.values[index])}`}</title></circle>)}
                </g>;
              })}
            </g>)}
            {active ? <line x1={x(activeIndex)} x2={x(activeIndex)} y1={TOP} y2={HEIGHT - BOTTOM} stroke="#fafafa" strokeDasharray="4 4" strokeOpacity="0.45" /> : null}
            {points.map((point, index) => <rect key={point.date} x={x(index) - (WIDTH - LEFT - RIGHT) / Math.max(points.length - 1, 1) / 2} y={TOP} width={(WIDTH - LEFT - RIGHT) / Math.max(points.length - 1, 1)} height={HEIGHT - TOP - BOTTOM} fill="transparent" onPointerMove={() => setSelected(index)} onClick={() => setSelected(index)}><title>{`${dateLabel(point.date)} · ${visible.map(item => `${item.label}: ${rangeLabel(item.values[index])}`).join('; ')}`}</title></rect>)}
          </svg>
        </div> : <p className="py-10 text-sm text-zinc-400 text-center">{visible.length ? 'Für diese Messreihe fehlen noch geeignete Daten.' : 'Wähle oben mindestens eine Linie aus.'}</p>}
        {active ? <>
          <label className="block text-xs text-zinc-400">Woche auswählen · {new Date(active.date).toLocaleDateString('de-DE')}
            <input type="range" min="0" max={Math.max(points.length - 1, 0)} value={Math.max(activeIndex, 0)} onChange={event => setSelected(Number(event.target.value))} aria-valuetext={new Date(active.date).toLocaleDateString('de-DE')} className="block w-full mt-3 accent-orange-400 cursor-pointer" />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" aria-live="polite" aria-atomic="true">
            {visible.map(item => <div key={item.id} className="rounded-xl bg-zinc-900 p-3 border border-zinc-800"><span className="text-xs font-semibold" style={{ color: item.color }}>{item.label}</span><p className="text-sm font-bold text-white mt-1">{rangeLabel(item.values[activeIndex])}</p></div>)}
          </div>
          {metric === 'vo2max' ? <p className="text-xs text-zinc-500">{active.vo2max.sampleCount} geeignete Läufe · {active.vo2max.reason}</p> : null}
        </> : null}
      </div>
      <p className="text-xs text-zinc-400">{metric === 'paces' ? 'Die farbigen Bänder zeigen den empfohlenen Tempobereich pro Trainingsart. Beide Grenzen werden dargestellt; Lücken bedeuten fehlende Daten.' : metric === 'zones' ? 'Die farbigen Bänder zeigen Unter- und Obergrenze jeder Pulszone. Änderungen folgen den verwendeten Maximal- und Ruhepulswerten.' : metric === 'vo2max' ? 'VO₂max ist eine grobe Modellschätzung, geglättet über sechs Wochen. Mindestens drei geeignete Läufe an unterschiedlichen Tagen sind erforderlich.' : metric === 'vdot' ? 'VDOT ist ein Leistungsindex aus zwölf Wochen Laufdaten. Mindestens vier geeignete Läufe sind erforderlich.' : 'Die Werte beziehen sich auf den jeweiligen Stichtag. Gewicht und Ruhepuls werden aus dem letzten bis dahin erfassten Eintrag übernommen.'}</p>
      <button type="button" onClick={() => setShowTable(previous => !previous)} aria-expanded={showTable} className="text-xs font-semibold text-orange-400 hover:text-orange-300 cursor-pointer">{showTable ? 'Wertetabelle ausblenden' : 'Messwerte als Tabelle anzeigen'}</button>
      {showTable ? <div className="overflow-auto max-h-80 rounded-xl border border-zinc-800"><table className="w-full text-xs text-left whitespace-nowrap">
        <caption className="sr-only">{label}: sämtliche Wochenwerte</caption>
        <thead className="bg-zinc-950 text-zinc-400"><tr><th scope="col" className="p-3">Datum</th>{visible.map(item => <th key={item.id} scope="col" className="p-3">{item.label} ({unit})</th>)}</tr></thead>
        <tbody className="divide-y divide-zinc-800 text-zinc-300">{points.map((point, index) => <tr key={point.date}><th scope="row" className="p-3">{new Date(point.date).toLocaleDateString('de-DE')}</th>{visible.map(item => <td key={item.id} className="p-3">{rangeLabel(item.values[index])}</td>)}</tr>)}</tbody>
      </table></div> : null}
      <p className="text-xs text-zinc-500">Historische manuelle VDOT- und Maximalpuls-Vorgaben sind unbekannt. Pulszonen verwenden den damaligen aufgezeichneten Höchstpuls, sonst 185 bpm als Annahme; dieser ist kein Nachweis des tatsächlichen Maximalpulses. Rekonstruierte Paces und Zonen können von damaligen manuellen Einstellungen abweichen.</p>
    </section>
  );
}
