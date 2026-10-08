'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { RefreshCw, ArrowLeft, ExternalLink, Calendar, MapPin, Footprints, Bike, Flame, Award } from 'lucide-react';
import { StravaIcon } from '@/components/icons/BrandIcons';

interface ActivityItem {
  id: string;
  stravaId: string;
  name: string;
  distance: number;
  movingTime: number;
  totalElevationGain: number;
  sportType: string;
  startDate: string;
  averageSpeed: number | null;
  kudosCount: number;
}

interface DashboardViewProps {
  user: {
    id: string;
    firstname: string | null;
    lastname: string | null;
    username: string | null;
    profile: string | null;
    city: string | null;
    country: string | null;
    stravaAthleteId: string;
  };
  activities: ActivityItem[];
  stats: {
    totalDistanceKm: number;
    totalHours: number;
    totalElevation: number;
    activityCount: number;
  };
  lastSync: string | null;
}

function formatPace(metersPerSec: number | null, sportType: string): string {
  if (!metersPerSec || metersPerSec <= 0) return '-';
  if (sportType.toLowerCase().includes('ride')) {
    const kmh = (metersPerSec * 3.6).toFixed(1);
    return `${kmh} km/h`;
  }
  // Running pace: min/km
  const paceSeconds = 1000 / metersPerSec;
  const mins = Math.floor(paceSeconds / 60);
  const secs = Math.floor(paceSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')} /km`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  }
  return `${m}:${s.toString().padStart(2, '0')}m`;
}

export function DashboardView({ user, activities, stats, lastSync }: DashboardViewProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [filterSport, setFilterSport] = useState<string>('all');

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setSyncMessage(null);
      const res = await fetch('/api/strava/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(data.message || 'Synchronisation erfolgreich abgeschlossen!');
        // Seite nach 1 Sekunde neu laden um neue Aktivitäten anzuzeigen
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setSyncMessage(data.error || 'Fehler beim Synchronisieren');
      }
    } catch {
      setSyncMessage('Netzwerkfehler beim Synchronisieren');
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredActivities = activities.filter((act) => {
    if (filterSport === 'all') return true;
    if (filterSport === 'run') return act.sportType.toLowerCase().includes('run');
    if (filterSport === 'ride') return act.sportType.toLowerCase().includes('ride');
    return true;
  });

  const displayName = [user.firstname, user.lastname].filter(Boolean).join(' ') || user.username || 'Dorfdüsen Athlet';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Top Bar with back link & logout */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Zurück zur Startseite</span>
        </Link>
        <div className="flex items-center gap-3">
          <a
            href={`https://www.strava.com/athletes/${user.stravaAthleteId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
          >
            <StravaIcon className="w-3.5 h-3.5 text-[#fc5200]" />
            <span>Strava Profil</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>
          <a
            href="/api/auth/logout"
            className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors"
          >
            Abmelden
          </a>
        </div>
      </div>

      {/* User Header Profile Card */}
      <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-orange-500 shadow-xl shadow-orange-500/20 shrink-0 bg-zinc-950">
              {user.profile ? (
                <Image src={user.profile} alt={displayName} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-orange-400 font-bold text-2xl">
                  {displayName.charAt(0)}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-600/20 text-orange-400 border border-orange-500/30">
                  Verifiziert via Strava
                </span>
                {user.city && (
                  <span className="text-xs text-zinc-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-zinc-500" />
                    {user.city}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">{displayName}</h1>
              <p className="text-xs text-zinc-400">
                Strava Athlete ID: <span className="font-mono text-zinc-300">#{user.stravaAthleteId}</span>
              </p>
            </div>
          </div>

          {/* Sync Button */}
          <div className="flex flex-col items-start md:items-end gap-2 w-full md:w-auto">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold bg-[#fc5200] hover:bg-[#e04800] disabled:bg-zinc-800 text-white shadow-xl shadow-[#fc5200]/25 transition-all text-sm cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronisiere Aktivitäten...' : 'Aktivitäten synchronisieren'}</span>
            </button>
            {lastSync && (
              <span className="text-[11px] text-zinc-500">
                Zuletzt synchronisiert: {new Date(lastSync).toLocaleString('de-DE')}
              </span>
            )}
            {syncMessage && (
              <span className="text-xs font-semibold text-emerald-400 animate-fade-in">
                {syncMessage}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Gesamtdistanz
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {stats.totalDistanceKm.toFixed(1)} <span className="text-sm text-orange-400 font-bold">km</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">In der Datenbank synchronisiert</div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Bewegungszeit
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {stats.totalHours.toFixed(1)} <span className="text-sm text-orange-400 font-bold">Std</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Aktiv auf der Strecke</div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Höhenmeter
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {Math.round(stats.totalElevation)} <span className="text-sm text-orange-400 font-bold">m</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Überwundene Steigung</div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Aktivitäten
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {stats.activityCount} <span className="text-sm text-orange-400 font-bold">Workouts</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Läufe, Fahrten & mehr</div>
        </div>
      </div>

      {/* Activities List Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight uppercase">
              Deine Aktivitäten
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Automatisch aus Strava synchronisiert und in der Datenbank gespeichert.
            </p>
          </div>

          {/* Sport Type Filters */}
          <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
            <button
              onClick={() => setFilterSport('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterSport === 'all' ? 'bg-orange-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Alle ({activities.length})
            </button>
            <button
              onClick={() => setFilterSport('run')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterSport === 'run' ? 'bg-orange-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Laufen
            </button>
            <button
              onClick={() => setFilterSport('ride')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterSport === 'ride' ? 'bg-orange-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Rennrad
            </button>
          </div>
        </div>

        {/* Activities Table / Cards */}
        {filteredActivities.length === 0 ? (
          <div className="rounded-3xl bg-zinc-900/60 border border-zinc-800 p-12 text-center space-y-4">
            <Flame className="w-12 h-12 text-zinc-600 mx-auto" />
            <div className="text-lg font-bold text-white">Noch keine Aktivitäten gefunden</div>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              Klicke oben auf <span className="text-orange-400 font-semibold">«Aktivitäten synchronisieren»</span>, um
              deine letzten Läufe und Fahrten direkt von Strava zu laden.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActivities.map((act) => {
              const isRun = act.sportType.toLowerCase().includes('run');
              const isRide = act.sportType.toLowerCase().includes('ride');
              const distKm = (act.distance / 1000).toFixed(2);
              const durationStr = formatDuration(act.movingTime);
              const paceStr = formatPace(act.averageSpeed, act.sportType);
              const dateStr = new Date(act.startDate).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });

              return (
                <div
                  key={act.id}
                  className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-zinc-700 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        isRun
                          ? 'bg-orange-600/15 text-orange-400 border border-orange-500/30'
                          : isRide
                          ? 'bg-amber-600/15 text-amber-400 border border-amber-500/30'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {isRun ? (
                        <Footprints className="w-6 h-6" />
                      ) : isRide ? (
                        <Bike className="w-6 h-6" />
                      ) : (
                        <Flame className="w-6 h-6" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          {act.sportType}
                        </span>
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {dateStr}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white group-hover:text-orange-400 transition-colors">
                        {act.name}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 border-zinc-800/80 pt-3 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <div className="text-base sm:text-lg font-black text-white">{distKm} km</div>
                      <div className="text-xs text-zinc-400">{durationStr}</div>
                    </div>

                    <div className="text-left sm:text-right min-w-[70px]">
                      <div className="text-sm font-bold text-zinc-200">{paceStr}</div>
                      <div className="text-xs text-zinc-500">+{Math.round(act.totalElevationGain)} m</div>
                    </div>

                    <div className="flex items-center gap-2">
                      {act.kudosCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 text-xs text-orange-400 font-bold" title="Kudos">
                          <Award className="w-3.5 h-3.5" />
                          {act.kudosCount}
                        </span>
                      )}
                      <a
                        href={`https://www.strava.com/activities/${act.stravaId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                        title="Auf Strava ansehen"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
