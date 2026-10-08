'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Trophy, Footprints, Bike, Flame, ArrowUpDown, Loader2 } from 'lucide-react';
import { LeaderboardEntry } from '@/lib/arena/stats';
import { isValidAvatarUrl } from '@/lib/utils/avatar';

interface MultiLeaderboardProps {
  initialEntries: LeaderboardEntry[];
}

export function MultiLeaderboard({ initialEntries }: MultiLeaderboardProps) {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [sport, setSport] = useState<'all' | 'run' | 'ride'>('all');
  const [sortBy, setSortBy] = useState<'distance' | 'time' | 'elevation' | 'activities'>('distance');
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initialEntries);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync initialEntries when props update
  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    let isCancelled = false;
    setIsLoading(true);

    fetch(`/api/arena/leaderboard?period=${period}&sport=${sport}`)
      .then((res) => {
        if (!res.ok) throw new Error('Netzwerkfehler beim Laden des Leaderboards');
        return res.json();
      })
      .then((data) => {
        if (!isCancelled && data.success && Array.isArray(data.leaderboard)) {
          setEntries(data.leaderboard);
        }
      })
      .catch((err) => {
        console.error('Fehler beim Laden des Leaderboards:', err);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [period, sport]);

  // Client-side sort
  const sortedEntries = [...entries].sort((a, b) => {
    if (sortBy === 'distance') return b.totalDistanceKm - a.totalDistanceKm;
    if (sortBy === 'time') return b.totalHours - a.totalHours;
    if (sortBy === 'elevation') return b.totalElevation - a.totalElevation;
    if (sortBy === 'activities') return b.activityCount - a.activityCount;
    return 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-600/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Trophy className="w-3.5 h-3.5" /> Multi-Leaderboard
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase">
              Das Düsen-Ranking
            </h2>
            {isLoading && (
              <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
            )}
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Filtern nach Zeitraum oder Sportart und verfolge den aktuellen Tabellenstand.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Period selector */}
          <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setPeriod('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === 'week' ? 'bg-orange-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Diese Woche
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === 'month' ? 'bg-orange-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Dieser Monat
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === 'all' ? 'bg-orange-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              All-Time
            </button>
          </div>

          {/* Sport type selector */}
          <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setSport('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                sport === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
              }`}
              title="Alle Sportarten"
            >
              Alle
            </button>
            <button
              onClick={() => setSport('run')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                sport === 'run' ? 'bg-zinc-800 text-orange-400' : 'text-zinc-400 hover:text-white'
              }`}
              title="Nur Laufen"
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>Lauf</span>
            </button>
            <button
              onClick={() => setSport('ride')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                sport === 'ride' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-400 hover:text-white'
              }`}
              title="Nur Rennrad"
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Rad</span>
            </button>
          </div>
        </div>
      </div>

      {/* Leaderboard Table / Cards */}
      {isLoading && entries.length === 0 ? (
        <div className="rounded-3xl bg-zinc-900/60 border border-zinc-800 p-12 text-center space-y-4">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" />
          <div className="text-lg font-bold text-white">Lade Ranking...</div>
        </div>
      ) : sortedEntries.length === 0 ? (
        <div className="rounded-3xl bg-zinc-900/60 border border-zinc-800 p-12 text-center space-y-4">
          <Flame className="w-12 h-12 text-zinc-600 mx-auto" />
          <div className="text-lg font-bold text-white">Noch keine Aktivitäten für diese Filterung</div>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            Verbinde deinen Strava-Account im Dashboard, um deine Kilometer hier anzeigen zu lassen.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs"
          >
            Jetzt mit Strava verbinden
          </Link>
        </div>
      ) : (
        <div className={`rounded-3xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-2xl transition-opacity duration-200 ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] font-black uppercase tracking-wider text-zinc-400 bg-zinc-950/40">
                  <th className="py-4 px-4 sm:px-6 w-16 text-center">Rang</th>
                  <th className="py-4 px-4">Athlet</th>
                  <th
                    className={`py-4 px-4 cursor-pointer transition-colors ${sortBy === 'distance' ? 'text-white' : 'hover:text-white'}`}
                    onClick={() => setSortBy('distance')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Distanz</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === 'distance' ? 'text-orange-500' : 'text-zinc-600'}`} />
                    </div>
                  </th>
                  <th
                    className={`py-4 px-4 cursor-pointer transition-colors hidden sm:table-cell ${sortBy === 'time' ? 'text-white' : 'hover:text-white'}`}
                    onClick={() => setSortBy('time')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Zeit</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === 'time' ? 'text-orange-500' : 'text-zinc-600'}`} />
                    </div>
                  </th>
                  <th
                    className={`py-4 px-4 cursor-pointer transition-colors hidden md:table-cell ${sortBy === 'elevation' ? 'text-white' : 'hover:text-white'}`}
                    onClick={() => setSortBy('elevation')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Höhe</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === 'elevation' ? 'text-orange-500' : 'text-zinc-600'}`} />
                    </div>
                  </th>
                  <th className="py-4 px-4 hidden lg:table-cell">
                    {sport === 'ride' ? 'Ø Tempo' : 'Ø Pace'}
                  </th>
                  <th
                    className={`py-4 px-4 cursor-pointer transition-colors text-right pr-6 ${sortBy === 'activities' ? 'text-white' : 'hover:text-white'}`}
                    onClick={() => setSortBy('activities')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Workouts</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === 'activities' ? 'text-orange-500' : 'text-zinc-600'}`} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {sortedEntries.map((row, idx) => {
                  const isTop1 = idx === 0;
                  const isTop2 = idx === 1;
                  const isTop3 = idx === 2;

                  return (
                    <tr
                      key={row.userId}
                      className="hover:bg-zinc-800/40 transition-colors group"
                    >
                      {/* Rank badge */}
                      <td className="py-4 px-4 sm:px-6 text-center font-black">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs ${
                            isTop1
                              ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40 shadow-md shadow-amber-400/20'
                              : isTop2
                              ? 'bg-zinc-400/20 text-zinc-200 border border-zinc-400/40'
                              : isTop3
                              ? 'bg-amber-700/20 text-amber-500 border border-amber-700/40'
                              : 'text-zinc-500'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>

                      {/* Athlete Profile */}
                      <td className="py-4 px-4">
                        <Link
                          href={`/dashboard?userId=${row.userId}`}
                          className="flex items-center gap-3 group/link hover:opacity-90 transition-opacity"
                          title={`${row.name} im Dashboard ansehen`}
                        >
                          <div className="relative w-9 h-9 rounded-full overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700">
                            {isValidAvatarUrl(row.profile) ? (
                              <Image
                                src={row.profile!}
                                alt={row.name}
                                fill
                                unoptimized
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-orange-400">
                                {row.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white group-hover/link:text-orange-400 transition-colors">
                              {row.name}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              Dorfdüse #{idx + 1}
                            </div>
                          </div>
                        </Link>
                      </td>

                      {/* Distance */}
                      <td className="py-4 px-4 font-black text-white text-base">
                        {row.totalDistanceKm.toFixed(1)}{' '}
                        <span className="text-xs text-orange-400 font-bold">km</span>
                      </td>

                      {/* Time */}
                      <td className="py-4 px-4 text-zinc-300 hidden sm:table-cell">
                        {row.totalHours.toFixed(1)} Std
                      </td>

                      {/* Elevation */}
                      <td className="py-4 px-4 text-zinc-400 hidden md:table-cell">
                        +{Math.round(row.totalElevation)} m
                      </td>

                      {/* Average Pace */}
                      <td className="py-4 px-4 text-zinc-400 hidden lg:table-cell font-mono text-xs">
                        {row.averagePace}
                      </td>

                      {/* Workouts count */}
                      <td className="py-4 px-4 text-right pr-6 font-bold text-zinc-300">
                        {row.activityCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
