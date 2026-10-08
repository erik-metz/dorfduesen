import React from 'react';
import { Award, Sparkles } from 'lucide-react';

interface BadgesShowcaseProps {
  badges: {
    code: string;
    name: string;
    description: string;
    icon: string;
    category: string;
  }[];
}

export function BadgesShowcase({ badges }: BadgesShowcaseProps) {
  return (
    <div className="space-y-6 pt-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-600/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Award className="w-3.5 h-3.5" /> Auszeichnungen & Meilensteine
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase">
            Die Düsen-Badges
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Erreiche sportliche Meilensteine, um dauerhafte Abzeichen für dein Profil freizuschalten.
          </p>
        </div>

        <div className="text-xs text-zinc-500 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-orange-400" />
          <span>Automatische Freischaltung beim Strava-Sync</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {badges.map((b) => (
          <div
            key={b.code}
            className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-colors flex items-start gap-4 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform shadow-inner">
              {b.icon}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  {b.category}
                </span>
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-orange-400 transition-colors">
                {b.name}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {b.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
