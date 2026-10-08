'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Crown, Sparkles } from 'lucide-react';
import { ChampionTitle } from '@/lib/arena/stats';
import { isValidAvatarUrl } from '@/lib/utils/avatar';

interface WeeklyChampionsProps {
  champions: ChampionTitle[];
  currentUserId?: string | null;
}

export function WeeklyChampions({ champions, currentUserId }: WeeklyChampionsProps) {
  const [activeUserId, setActiveUserId] = useState<string | null>(currentUserId || null);

  useEffect(() => {
    if (!activeUserId) {
      fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.authenticated && data?.user?.id) {
            setActiveUserId(data.user.id);
          }
        })
        .catch(() => {});
    }
  }, [activeUserId]);
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-600/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Crown className="w-3.5 h-3.5" /> Wöchentliche Ehren-Titel
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase">
            Die Champions der Woche
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Wird jede Woche am Montag um 00:00 Uhr neu vergeben. Wer holt sich die Dorfdüsen-Kronen?
          </p>
        </div>

        <Link
          href="/dashboard"
          className="text-xs font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Aktivitäten ansehen & mitmischen →</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {champions.map((champ) => {
          const hasWinner = Boolean(champ.winner);

          const isCurrentUser = Boolean(activeUserId && champ.winner?.userId === activeUserId);

          return (
            <div
              key={champ.id}
              className={`rounded-3xl border p-6 flex flex-col justify-between transition-all relative overflow-hidden group shadow-xl ${
                isCurrentUser
                  ? 'bg-gradient-to-b from-orange-950/30 to-zinc-900/90 border-orange-500/60 shadow-orange-950/20 ring-1 ring-orange-500/40'
                  : hasWinner
                  ? 'bg-zinc-900/80 border-zinc-800 hover:border-orange-500/50'
                  : 'bg-zinc-950/60 border-zinc-900 hover:border-zinc-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl p-2.5 bg-zinc-950 rounded-2xl border border-zinc-800/80 inline-block shadow-inner">
                    {champ.icon}
                  </span>
                  {isCurrentUser ? (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                      Deine Führung 👑
                    </span>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-zinc-800/80 text-zinc-400">
                      Wochentitel
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-black text-white tracking-tight leading-snug">
                  {champ.title}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {champ.subtitle}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-zinc-800/80">
                {hasWinner && champ.winner ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-orange-500 shrink-0 bg-zinc-950">
                        {isValidAvatarUrl(champ.winner.profile) ? (
                          <Image
                            src={champ.winner.profile!}
                            alt={champ.winner.name}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-orange-400">
                            {champ.winner.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-orange-400 font-bold uppercase tracking-wider">
                          {isCurrentUser ? 'Du bist in Führung' : 'Aktuelle Führung'}
                        </div>
                        <div className="text-sm font-bold text-white truncate">
                          {isCurrentUser ? 'Du' : champ.winner.name}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm sm:text-base font-black text-white">
                        {champ.winner.formattedValue}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span className="italic">Noch unbesetzt</span>
                    <Link
                      href="/dashboard"
                      className="text-orange-400 font-bold hover:underline"
                    >
                      Hol dir die Krone!
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
