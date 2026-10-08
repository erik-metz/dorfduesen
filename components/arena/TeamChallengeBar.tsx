import React from 'react';
import { Target, Calendar, Flame } from 'lucide-react';
import { TeamChallenge } from '@/lib/arena/stats';

interface TeamChallengeBarProps {
  challenge: TeamChallenge;
}

export function TeamChallengeBar({ challenge }: TeamChallengeBarProps) {
  const percentageRounded = Math.round(challenge.percentage);

  return (
    <div className="rounded-3xl bg-gradient-to-r from-orange-950/40 via-zinc-900 to-zinc-900/80 border border-orange-500/30 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/30">
              <Target className="w-4 h-4" />
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-orange-400">
              Aktuelle Team-Challenge
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {challenge.title}
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400">
            {challenge.description}
          </p>
        </div>

        <div className="flex items-center gap-4 self-start md:self-auto">
          <div className="text-left md:text-right">
            <div className="text-2xl sm:text-3xl font-black text-white">
              {challenge.currentKm.toFixed(1)}{' '}
              <span className="text-sm font-bold text-zinc-500">/ {challenge.targetKm} km</span>
            </div>
            <div className="text-xs text-orange-400 font-bold flex items-center md:justify-end gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Noch {challenge.daysRemaining} Tage</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="space-y-2">
        <div className="w-full h-5 rounded-full bg-zinc-950 p-1 border border-zinc-800 shadow-inner relative overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 transition-all duration-1000 shadow-lg shadow-orange-600/40 relative"
            style={{ width: `${Math.max(4, Math.min(100, challenge.percentage))}%` }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
          <span className="flex items-center gap-1 font-bold text-zinc-300">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            {percentageRounded}% erreicht
          </span>
          <span>Ziel: {challenge.targetKm} km</span>
        </div>
      </div>
    </div>
  );
}
