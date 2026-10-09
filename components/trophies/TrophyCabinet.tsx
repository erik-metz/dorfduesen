'use client';

import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Award,
  Crown,
  Sparkles,
  Lock,
  CheckCircle2,
  Flame,
  Star,
  RefreshCw,
  X,
  ChevronRight,
  Info,
} from 'lucide-react';

export interface TrophyItem {
  code: string;
  name: string;
  description: string;
  icon: string;
  category: 'DISTANCE' | 'STREAK' | 'SPECIAL' | 'SPEED' | 'WEEKLY' | 'MONTHLY' | 'COMMUNITY';
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  hint?: string;
  isUnlocked: boolean;
  level: number;
  unlockedAt: string | null;
  metadata: Record<string, unknown> | null;
}

interface TrophyCabinetProps {
  initialBadges?: TrophyItem[];
  userId?: string;
  isReadOnly?: boolean;
}

const RARITY_CONFIG: Record<
  string,
  { label: string; border: string; glow: string; text: string; bg: string }
> = {
  COMMON: {
    label: 'Standard',
    border: 'border-zinc-700/60',
    glow: 'group-hover:border-zinc-500',
    text: 'text-zinc-400',
    bg: 'bg-zinc-800/40',
  },
  RARE: {
    label: 'Selten',
    border: 'border-blue-500/30',
    glow: 'group-hover:border-blue-400/60 shadow-blue-500/5',
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  EPIC: {
    label: 'Episch',
    border: 'border-purple-500/30',
    glow: 'group-hover:border-purple-400/60 shadow-purple-500/10',
    text: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  LEGENDARY: {
    label: 'Legendär',
    border: 'border-amber-500/40',
    glow: 'group-hover:border-amber-400/80 shadow-amber-500/20',
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
};

const WEEKLY_TITLES = [
  { id: 'run_distance', code: 'WEEKLY_RUN_DISTANCE', title: 'Laufleistung der Woche', icon: '🏃', desc: 'Meiste Laufkilometer · Gleichstände teilen den Sieg' },
  { id: 'ride_distance', code: 'WEEKLY_RIDE_DISTANCE', title: 'Radleistung der Woche', icon: '🚲', desc: 'Meiste Radkilometer · ohne E-Bike' },
  { id: 'stayed_active', code: 'WEEKLY_STAYED_ACTIVE', title: 'Drangeblieben', icon: '🌱', desc: 'Mindestens zwei aktive Tage' },
  { id: 'routine', code: 'WEEKLY_ROUTINE', title: 'Gute Routine', icon: '📅', desc: 'Drei Wochen mit jeweils mindestens zwei aktiven Tagen' },
  { id: 'goal', code: 'WEEKLY_GOAL', title: 'Wochenziel geschafft', icon: '🎯', desc: 'Dein vor Wochenbeginn gewähltes Tagesziel erreicht' },
  { id: 'progress', code: 'WEEKLY_PROGRESS', title: 'Persönlicher Fortschritt', icon: '✨', desc: 'Mehr aktive Tage als dein Vier-Wochen-Durchschnitt' },
  { id: 'elevation', code: 'WEEKLY_ELEVATION', title: 'Die Bergziege', icon: '⛰️', desc: 'Meiste Höhenmeter der Woche' },
  { id: 'distance', code: 'WEEKLY_DISTANCE', title: 'Kilometer-Krone', icon: '👑', desc: 'Meiste Wochenkilometer' },
  { id: 'time', code: 'WEEKLY_TIME', title: 'Ausdauer-Büffel', icon: '⏱️', desc: 'Längste Bewegungszeit' },
  { id: 'heartrate', code: 'WEEKLY_HEARTRATE', title: 'Die Eisenlunge', icon: '💓', desc: 'Höchster Puls-Peak' },
  { id: 'early_bird', code: 'WEEKLY_EARLYBIRD', title: 'Frühaufsteher', icon: '🌅', desc: 'Früheste Einheit vor 08:00 Uhr' },
  { id: 'consistency', code: 'WEEKLY_CONSISTENCY', title: 'Dauer-Düser', icon: '📅', desc: 'Meiste Aktivitäten in der Woche' },
];

export function TrophyCabinet({ initialBadges, userId, isReadOnly = false }: TrophyCabinetProps) {
  const [badges, setBadges] = useState<TrophyItem[]>(initialBadges || []);
  const [loading, setLoading] = useState(!initialBadges || initialBadges.length === 0);
  const [evaluating, setEvaluating] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [activeLeaderTitles, setActiveLeaderTitles] = useState<string[]>([]);
  const [selectedTrophy, setSelectedTrophy] = useState<TrophyItem | null>(null);

  const apiEndpoint = userId ? `/api/trophies?userId=${encodeURIComponent(userId)}` : '/api/trophies';

  const reloadTrophies = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiEndpoint);
      const data = await res.json();
      if (res.ok && data.badges) {
        setBadges(data.badges);
        if (data.currentWeekLeaderTitles) {
          setActiveLeaderTitles(data.currentWeekLeaderTitles);
        }
      }
    } catch (e) {
      console.error('Fehler beim Laden der Trophäen:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const res = await fetch(apiEndpoint);
        const data = await res.json();
        if (!ignore && res.ok && data.badges) {
          setBadges(data.badges);
          if (data.currentWeekLeaderTitles) {
            setActiveLeaderTitles(data.currentWeekLeaderTitles);
          }
        }
      } catch (e) {
        console.error('Fehler beim Laden der Trophäen:', e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, [apiEndpoint]);

  const handleEvaluate = async () => {
    if (isReadOnly) return;
    try {
      setEvaluating(true);
      const res = await fetch('/api/trophies/evaluate', { method: 'POST' });
      if (res.ok) {
        await reloadTrophies();
      }
    } catch (e) {
      console.error('Fehler bei Auswertung:', e);
    } finally {
      setEvaluating(false);
    }
  };

  const unlockedCount = badges.filter((b) => b.isUnlocked).length;
  const totalCount = badges.length;
  const progressPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  const weeklyCrownsTotal = badges
    .filter((b) => b.category === 'WEEKLY' && b.isUnlocked)
    .reduce((sum, b) => sum + b.level, 0);

  const monthlyAwardsTotal = badges
    .filter((b) => b.category === 'MONTHLY' && b.isUnlocked)
    .reduce((sum, b) => sum + b.level, 0);

  const filteredBadges = badges.filter((b) => {
    if (categoryFilter === 'ALL') return true;
    if (categoryFilter === 'UNLOCKED') return b.isUnlocked;
    if (categoryFilter === 'LOCKED') return !b.isUnlocked;
    if (categoryFilter === 'WEEKLY') return b.category === 'WEEKLY';
    if (categoryFilter === 'MONTHLY') return b.category === 'MONTHLY';
    if (categoryFilter === 'DISTANCE') return b.category === 'DISTANCE';
    if (categoryFilter === 'COMMUNITY') return b.category === 'COMMUNITY' || b.category === 'STREAK';
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Vitrinen Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800 p-6 sm:p-8 shadow-2xl">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 blur-[100px] pointer-events-none rounded-full" />
        <div className="absolute bottom-0 left-10 w-60 h-60 bg-orange-600/10 blur-[90px] pointer-events-none rounded-full" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5" /> Dorfdüsen Vitrine & Trophäenschrank
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase">
              Deine Erfolge & Trophäen
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Hier stehen alle deine errungenen Wochentitel, Monatskronen und persönlichen Meilensteine.
              Jeder gelaufene Kilometer und jeder Sonntags-Lauf bringt dich der nächsten Auszeichnung näher.
            </p>
          </div>

          {/* Action & Quick Stats */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {!isReadOnly ? (
              <button
                onClick={handleEvaluate}
                disabled={evaluating}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 text-xs font-bold border border-zinc-700 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin text-orange-400' : ''}`} />
                <span>{evaluating ? 'Prüfe Erfolge...' : 'Erfolge neu abgleichen'}</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-xs text-zinc-400">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Vitrine (Nur Ansicht)</span>
              </div>
            )}
          </div>
        </div>

        {/* Counter Stats Shelf */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-zinc-800/80">
          <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase mb-1">
              <span>Freigeschaltet</span>
              <Award className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {unlockedCount}{' '}
              <span className="text-xs text-zinc-500 font-semibold">/ {totalCount}</span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-orange-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase mb-1">
              <span>Wochenkronen</span>
              <Crown className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400">
              {weeklyCrownsTotal} <span className="text-xs text-zinc-400 font-normal">Siege</span>
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">Ewige Kalenderwochen-Siege</div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase mb-1">
              <span>Monats-Pokale</span>
              <Trophy className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-purple-400">
              {monthlyAwardsTotal} <span className="text-xs text-zinc-400 font-normal">Pokale</span>
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">Century Club & Monats-König</div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase mb-1">
              <span>Club-Abschluss</span>
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">{progressPercent}%</div>
            <div className="text-[11px] text-zinc-500 mt-1">Vollständigkeit der Vitrine</div>
          </div>
        </div>
      </div>

      {/* Sektion: Die 6 Wochentitel der Dorfdüsen (Ehrentafel) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
              <Crown className="w-3.5 h-3.5" /> Die Ehrentafel
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
              Deine Wochen-Erfolge
            </h3>
            <p className="text-xs text-zinc-400">
              Jeden Montag nach Wochenabschluss werden deine Erfolge ausgezeichnet. Bisherige Trophäen bleiben erhalten. Die neuen Regeln gelten bereits für die laufende Woche.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {WEEKLY_TITLES.filter(wt => ['run_distance', 'ride_distance', 'stayed_active', 'routine', 'goal', 'progress'].includes(wt.id) || badges.some(b => b.code === wt.code && b.isUnlocked) || activeLeaderTitles.includes(wt.id)).map((wt) => {
            const badge = badges.find((b) => b.code === wt.code);
            const isLeaderCurrentWeek = activeLeaderTitles.includes(wt.id);
            const winCount = badge?.level || 0;
            const history = (badge?.metadata?.history as Array<Record<string, unknown>>) || [];

            return (
              <div
                key={wt.id}
                onClick={() => badge && setSelectedTrophy(badge)}
                className={`p-5 rounded-2xl transition-all cursor-pointer border relative overflow-hidden group ${
                  winCount > 0
                    ? 'bg-gradient-to-br from-zinc-900 to-amber-950/20 border-amber-500/40 hover:border-amber-400 shadow-lg shadow-amber-500/5'
                    : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Live Leader Ribbon */}
                {isLeaderCurrentWeek && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase tracking-wider animate-pulse">
                    <Flame className="w-3 h-3 fill-emerald-400" />
                    <span>Diese Woche erreicht!</span>
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform shadow-inner">
                    {wt.icon}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                        Wochentitel
                      </span>
                      {winCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-black text-[10px]">
                          <Star className="w-2.5 h-2.5 fill-amber-300" />
                          {winCount}× Erreicht
                        </span>
                      )}
                    </div>

                    <h4 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                      {wt.title}
                    </h4>

                    <p className="text-xs text-zinc-400 line-clamp-1">{wt.desc}</p>

                    <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-500">
                      {winCount > 0 ? (
                        <span className="text-amber-400/90 font-medium">
                          Zuletzt erreicht: {String(history[history.length - 1]?.weekKey || 'KW eingetragen')}
                        </span>
                      ) : (
                        <span className="text-zinc-500 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Noch nicht erreicht
                        </span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Tabs für alle Badges */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-zinc-800/80">
        {[
          { id: 'ALL', label: 'Alle Trophäen', count: badges.length },
          { id: 'UNLOCKED', label: 'Freigeschaltet', count: unlockedCount },
          { id: 'WEEKLY', label: 'Wochenkronen', count: badges.filter((b) => b.category === 'WEEKLY').length },
          { id: 'MONTHLY', label: 'Monatspokale', count: badges.filter((b) => b.category === 'MONTHLY').length },
          { id: 'DISTANCE', label: 'Meilensteine', count: badges.filter((b) => b.category === 'DISTANCE').length },
          {
            id: 'COMMUNITY',
            label: 'Dorfdüsen Kult',
            count: badges.filter((b) => b.category === 'COMMUNITY' || b.category === 'STREAK').length,
          },
          { id: 'LOCKED', label: 'Noch gesperrt', count: badges.length - unlockedCount },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCategoryFilter(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              categoryFilter === tab.id
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'text-zinc-400 hover:text-white bg-zinc-900/60 border border-zinc-800'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                categoryFilter === tab.id ? 'bg-black/20 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Grid aller Trophäen */}
      {loading ? (
        <div className="py-20 text-center text-zinc-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2" />
          <span>Polieren der Trophäen-Vitrine...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBadges.map((badge) => {
            const rarityStyle = RARITY_CONFIG[badge.rarity] || RARITY_CONFIG.COMMON;
            const isUnlocked = badge.isUnlocked;

            return (
              <div
                key={badge.code}
                onClick={() => setSelectedTrophy(badge)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer relative group flex items-start gap-4 ${
                  isUnlocked
                    ? `bg-zinc-900/80 ${rarityStyle.border} ${rarityStyle.glow} hover:bg-zinc-900`
                    : 'bg-zinc-950/40 border-zinc-900/80 opacity-60 hover:opacity-90 hover:border-zinc-800'
                }`}
              >
                {/* Icon Socket */}
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 transition-transform group-hover:scale-105 shadow-inner ${
                    isUnlocked
                      ? 'bg-zinc-950 border border-zinc-800 ring-2 ring-orange-500/10'
                      : 'bg-zinc-950/70 border border-zinc-900 grayscale'
                  }`}
                >
                  {badge.icon}
                </div>

                {/* Content */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${rarityStyle.bg} ${rarityStyle.text}`}
                    >
                      {rarityStyle.label}
                    </span>
                    {badge.level > 1 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-amber-300" />
                        Stufe {badge.level}
                      </span>
                    )}
                  </div>

                  <h4
                    className={`text-base font-bold transition-colors ${
                      isUnlocked ? 'text-white group-hover:text-orange-400' : 'text-zinc-500'
                    }`}
                  >
                    {badge.name}
                  </h4>

                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {badge.description}
                  </p>

                  <div className="pt-2 flex items-center justify-between text-[11px]">
                    {isUnlocked ? (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Freigeschaltet
                      </span>
                    ) : (
                      <span className="text-zinc-500 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        Gesperrt
                      </span>
                    )}
                    <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors">
                      Details &rarr;
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trophy Detail Modal */}
      {selectedTrophy && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedTrophy(null)}
        >
          <div
            className="max-w-md w-full rounded-3xl bg-zinc-900 border border-zinc-800 p-6 sm:p-8 space-y-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedTrophy(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header / Big Icon */}
            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-3xl bg-zinc-950 border border-zinc-800 mx-auto flex items-center justify-center text-4xl shadow-xl ring-4 ring-orange-500/10">
                {selectedTrophy.icon}
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mb-1 bg-zinc-800 text-zinc-300">
                  {selectedTrophy.category} • {selectedTrophy.rarity}
                </div>
                <h3 className="text-2xl font-black text-white">{selectedTrophy.name}</h3>
              </div>
            </div>

            {/* Description */}
            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-sm text-zinc-300 leading-relaxed text-center">
              {selectedTrophy.description}
            </div>

            {/* Status & Hints */}
            <div className="space-y-3 text-xs">
              {selectedTrophy.isUnlocked ? (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-bold">Erfolgreich freigeschaltet!</div>
                    {selectedTrophy.unlockedAt && (
                      <div className="text-[11px] text-emerald-400/80">
                        Am {new Date(selectedTrophy.unlockedAt).toLocaleDateString('de-DE')}
                        {selectedTrophy.level > 1 && ` • Stufe ${selectedTrophy.level}`}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 flex items-start gap-3">
                  <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-zinc-200">Wie schalte ich das frei?</div>
                    <div>{selectedTrophy.hint || selectedTrophy.description}</div>
                  </div>
                </div>
              )}

              {/* History / Metadata details */}
              {selectedTrophy.metadata && Array.isArray(selectedTrophy.metadata.history) && (
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <div className="font-bold text-zinc-300 text-xs">Historie der Titelgewinne:</div>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {(selectedTrophy.metadata.history as Array<Record<string, unknown>>).map((h, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/80 text-[11px]"
                      >
                        <span className="font-medium text-amber-400">
                          {h.weekKey ? `KW ${String(h.weekKey)}` : (h.monthKey ? String(h.monthKey) : 'Erfolg')}
                        </span>
                        <span className="text-zinc-400 font-mono">
                          {h.formattedValue ? String(h.formattedValue) : (h.distanceKm ? `${String(h.distanceKm)} km` : 'Gewonnen')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
