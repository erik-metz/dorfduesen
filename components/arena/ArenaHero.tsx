import React from 'react';
import { Route, Clock, Activity, Users, Trophy } from 'lucide-react';

interface ArenaHeroProps {
  weekKm: number;
  weekHours: number;
  weekActivitiesCount: number;
  activeAthletesCount: number;
}

export function ArenaHero({
  weekKm,
  weekHours,
  weekActivitiesCount,
  activeAthletesCount,
}: ArenaHeroProps) {
  const kpis = [
    {
      label: 'Wochen-Kilometer',
      value: `${weekKm.toFixed(1)} km`,
      sub: 'Seit Montag gesammelt',
      icon: Route,
      color: 'text-orange-400',
      bg: 'bg-orange-600/10 border-orange-500/20',
    },
    {
      label: 'Bewegungszeit',
      value: `${weekHours.toFixed(1)} Std`,
      sub: 'Gemeinsam auf der Strecke',
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-600/10 border-amber-500/20',
    },
    {
      label: 'Workouts diese Woche',
      value: `${weekActivitiesCount}`,
      sub: 'Läufe, Fahrten & Runden',
      icon: Activity,
      color: 'text-emerald-400',
      bg: 'bg-emerald-600/10 border-emerald-500/20',
    },
    {
      label: 'Aktive Düsen',
      value: `${activeAthletesCount}`,
      sub: 'Mitglieder im Einsatz',
      icon: Users,
      color: 'text-sky-400',
      bg: 'bg-sky-600/10 border-sky-500/20',
    },
  ];

  return (
    <div className="relative overflow-hidden pt-8 pb-12">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-orange-600/15 blur-[140px] pointer-events-none rounded-full" />

      <div className="space-y-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-orange-400 text-xs font-bold uppercase tracking-wider shadow-sm">
          <Trophy className="w-3.5 h-3.5 text-orange-500" />
          <span>Dorfdüsen Gamification & Ranglisten</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tighter uppercase leading-[1.05]">
          Die <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600">Düsen-Arena</span>
        </h1>

        <p className="text-base sm:text-lg text-zinc-300 max-w-2xl mx-auto leading-relaxed">
          Wöchentliche Titel, gemeinsame Meilensteine und der sportliche Wettstreit im Ried. 
          Egal ob 5 km Sonntagsrunde oder 100 km Rennrad-Schleife: Jeder Kilometer zählt!
        </p>

        {/* 4 Weekly KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-left hover:border-zinc-700 transition-colors shadow-lg"
              >
                <div className={`p-2.5 rounded-xl inline-block border mb-3 ${kpi.bg}`}>
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {kpi.value}
                </div>
                <div className="text-xs sm:text-sm font-bold text-zinc-200 mt-1">
                  {kpi.label}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  {kpi.sub}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
