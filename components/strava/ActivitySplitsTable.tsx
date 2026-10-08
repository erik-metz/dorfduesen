'use client';

import React, { useState } from 'react';
import { ActivitySplit } from '@/lib/strava/activity-detail';
import { Heart, ChevronDown, ChevronUp } from 'lucide-react';

interface ActivitySplitsTableProps {
  splits: ActivitySplit[];
  sportType: string;
}

function formatSplitPace(metersPerSec: number, sportType: string): string {
  if (!metersPerSec || metersPerSec <= 0) return '-';
  if (sportType.toLowerCase().includes('ride')) {
    return `${(metersPerSec * 3.6).toFixed(1)} km/h`;
  }
  const paceSec = 1000 / metersPerSec;
  const m = Math.floor(paceSec / 60);
  const s = Math.floor(paceSec % 60);
  return `${m}:${s.toString().padStart(2, '0')} /km`;
}

export function ActivitySplitsTable({ splits, sportType }: ActivitySplitsTableProps) {
  const [showAll, setShowAll] = useState(false);

  if (!splits || splits.length === 0) {
    return null;
  }

  const isRide = sportType.toLowerCase().includes('ride');
  const speeds = splits.map((s) => s.average_speed).filter((s) => s > 0);
  const maxSpeed = Math.max(...speeds, 1);
  const minSpeed = Math.min(...speeds, 0);

  const displayedSplits = showAll ? splits : splits.slice(0, 7);

  return (
    <div className="space-y-2 bg-zinc-950/70 p-4 sm:p-5 rounded-2xl border border-zinc-800">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-300">
          Kilometer-Splits ({splits.length} km)
        </h4>
        <span className="text-[11px] text-zinc-500">
          {isRide ? 'Tempo & Höhenprofil' : 'Pace & Höhenmeter pro KM'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-zinc-800/80 text-[10px] font-bold uppercase text-zinc-500">
              <th className="py-2 px-2">KM</th>
              <th className="py-2 px-2">{isRide ? 'Tempo' : 'Pace'}</th>
              <th className="py-2 px-2 hidden sm:table-cell">Balken</th>
              <th className="py-2 px-2 text-right">Höhe</th>
              <th className="py-2 px-2 text-right">Herzfrequenz</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {displayedSplits.map((split) => {
              const paceStr = formatSplitPace(split.average_speed, sportType);
              const elevDiff = Math.round(split.elevation_difference);
              // Relative speed percentage for the bar
              const speedRatio = maxSpeed > minSpeed ? (split.average_speed - minSpeed) / (maxSpeed - minSpeed) : 0.5;
              const barPercent = Math.max(15, Math.min(100, Math.round(speedRatio * 100)));

              return (
                <tr key={split.split} className="hover:bg-zinc-900/50 transition-colors">
                  <td className="py-2 px-2 font-mono font-bold text-zinc-300">
                    {split.split}
                  </td>
                  <td className="py-2 px-2 font-mono font-semibold text-white">
                    {paceStr}
                  </td>
                  <td className="py-2 px-2 hidden sm:table-cell w-36">
                    <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-orange-500 h-full rounded-full transition-all"
                        style={{ width: `${barPercent}%` }}
                      />
                    </div>
                  </td>
                  <td className={`py-2 px-2 text-right font-mono ${elevDiff > 0 ? 'text-amber-400' : elevDiff < 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    {elevDiff > 0 ? `+${elevDiff}m` : elevDiff < 0 ? `${elevDiff}m` : '0m'}
                  </td>
                  <td className="py-2 px-2 text-right font-mono">
                    {split.average_heartrate ? (
                      <span className="inline-flex items-center gap-1 text-rose-400">
                        <Heart className="w-2.5 h-2.5 fill-rose-500/20 text-rose-500" />
                        {Math.round(split.average_heartrate)} bpm
                      </span>
                    ) : (
                      <span className="text-zinc-600">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {splits.length > 7 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2 flex items-center justify-center gap-1 text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors pt-1 cursor-pointer"
        >
          <span>{showAll ? 'Weniger Splits anzeigen' : `Alle ${splits.length} Splits anzeigen`}</span>
          {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}
