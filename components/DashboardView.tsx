'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  Calendar,
  MapPin,
  Footprints,
  Bike,
  Flame,
  Award,
  Heart,
  ChevronDown,
  ChevronUp,
  Loader2,
  Maximize2,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { StravaIcon } from '@/components/icons/BrandIcons';
import { polylineToSvgPath } from '@/lib/strava/polyline';
import { isValidAvatarUrl } from '@/lib/utils/avatar';
import { ActivityDetailData } from '@/lib/strava/activity-detail';
import { ActivityDetailCard } from '@/components/strava/ActivityDetailCard';

export interface ActivityItem {
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
  summaryPolyline?: string | null;
  averageHeartrate?: number | null;
  maxSpeed?: number | null;
  detailData?: ActivityDetailData | null;
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
  const [filterSport, setFilterSport] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Initialize cache with any pre-loaded detailData from DB
  const [detailsCache, setDetailsCache] = useState<Record<string, ActivityDetailData>>(() => {
    const initial: Record<string, ActivityDetailData> = {};
    for (const act of activities) {
      if (act.detailData) {
        initial[act.stravaId] = act.detailData;
      }
    }
    return initial;
  });

  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
  const [errorIds, setErrorIds] = useState<Record<string, string>>({});
  const [modalDetail, setModalDetail] = useState<ActivityDetailData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
      }
    };
    if (isModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const fetchActivityDetails = async (stravaId: string): Promise<ActivityDetailData | null> => {
    if (detailsCache[stravaId]) {
      return detailsCache[stravaId];
    }

    setLoadingIds((prev) => ({ ...prev, [stravaId]: true }));
    setErrorIds((prev) => ({ ...prev, [stravaId]: '' }));

    try {
      const res = await fetch(`/api/strava/activities/${stravaId}`);
      const data = await res.json();
      if (res.ok && data.activity) {
        setDetailsCache((prev) => ({ ...prev, [stravaId]: data.activity }));
        return data.activity;
      } else {
        const errMsg = data.error || 'Fehler beim Laden der Strava-Details';
        setErrorIds((prev) => ({ ...prev, [stravaId]: errMsg }));
        return null;
      }
    } catch {
      const errMsg = 'Netzwerkfehler beim Abrufen der Strava-Details';
      setErrorIds((prev) => ({ ...prev, [stravaId]: errMsg }));
      return null;
    } finally {
      setLoadingIds((prev) => ({ ...prev, [stravaId]: false }));
    }
  };

  const handleToggleExpand = async (stravaId: string) => {
    if (expandedId === stravaId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(stravaId);
    if (!detailsCache[stravaId]) {
      await fetchActivityDetails(stravaId);
    }
  };

  const handleOpenModal = async (e: React.MouseEvent, stravaId: string) => {
    e.stopPropagation();
    setIsModalOpen(true);
    if (detailsCache[stravaId]) {
      setModalDetail(detailsCache[stravaId]);
    } else {
      setModalDetail(null);
      const detail = await fetchActivityDetails(stravaId);
      if (detail) {
        setModalDetail(detail);
      }
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
              {isValidAvatarUrl(user.profile) ? (
                <Image src={user.profile!} alt={displayName} fill unoptimized className="object-cover" />
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

          {/* Auto-Sync Status Indicator */}
          <div className="flex flex-col items-start md:items-end gap-1.5 w-full md:w-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs font-medium text-zinc-300 shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Automatische Synchronisation aktiv</span>
            </div>
            {lastSync && (
              <span className="text-[11px] text-zinc-500">
                Zuletzt synchronisiert: {new Date(lastSync).toLocaleString('de-DE')}
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
              Klicke auf eine Aktivität, um alle Parameter, Splits, Diagramme und Details anzuzeigen.
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
              Sobald du neue Läufe oder Fahrten auf Strava hochlädst, werden sie hier automatisch synchronisiert.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
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

              const isExpanded = expandedId === act.stravaId;
              const isLoading = Boolean(loadingIds[act.stravaId]);
              const errorMsg = errorIds[act.stravaId];
              const detail = detailsCache[act.stravaId];

              return (
                <div
                  key={act.id}
                  className={`rounded-2xl transition-all duration-200 border ${
                    isExpanded
                      ? 'bg-zinc-900/90 border-orange-500/50 shadow-xl shadow-orange-500/5'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {/* Header Row (Clickable Accordion Trigger) */}
                  <div
                    onClick={() => handleToggleExpand(act.stravaId)}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                          isRun
                            ? 'bg-orange-600/15 text-orange-400 border border-orange-500/30'
                            : isRide
                            ? 'bg-amber-600/15 text-amber-400 border border-amber-500/30'
                            : 'bg-zinc-800 text-zinc-300'
                        } ${isExpanded ? 'scale-105 ring-2 ring-orange-500/40' : ''}`}
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
                        <h3 className="text-base font-bold text-white group-hover:text-orange-400 transition-colors flex items-center gap-2">
                          <span>{act.name}</span>
                        </h3>
                        {act.averageHeartrate && (
                          <div className="flex items-center gap-1 text-[11px] text-rose-400 font-semibold">
                            <Heart className="w-3 h-3 fill-rose-500/30 text-rose-400" />
                            <span>Ø {Math.round(act.averageHeartrate)} bpm</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mini GPS Route Preview */}
                    {act.summaryPolyline && (() => {
                      const svgPath = polylineToSvgPath(act.summaryPolyline, 100, 50, 6);
                      if (!svgPath) return null;
                      return (
                        <div
                          className="hidden lg:flex items-center justify-center w-24 h-12 bg-zinc-950/80 rounded-xl border border-zinc-800 px-2 py-1 shrink-0"
                          title="GPS-Track"
                        >
                          <svg viewBox="0 0 100 50" className="w-full h-full">
                            <path
                              d={svgPath}
                              fill="none"
                              stroke="#fc5200"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      );
                    })()}

                    <div className="flex items-center justify-between sm:justify-end gap-5 border-t sm:border-t-0 border-zinc-800/80 pt-3 sm:pt-0">
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
                          <span
                            className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 text-xs text-orange-400 font-bold"
                            title="Kudos"
                          >
                            <Award className="w-3.5 h-3.5" />
                            {act.kudosCount}
                          </span>
                        )}

                        {/* Fullscreen Modal Button */}
                        <button
                          onClick={(e) => handleOpenModal(e, act.stravaId)}
                          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                          title="Im Vollbild / Detail-Modal öffnen"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>

                        {/* External Strava link */}
                        <a
                          href={`https://www.strava.com/activities/${act.stravaId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                          title="Auf Strava ansehen"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>

                        {/* Accordion Chevron Trigger */}
                        <button
                          aria-label={isExpanded ? 'Details zuklappen' : 'Details aufklappen'}
                          className={`p-2 rounded-lg transition-all ${
                            isExpanded ? 'bg-orange-600 text-white shadow-md' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                          }`}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Accordion Body */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800/80 p-4 sm:p-6 bg-zinc-950/60 rounded-b-2xl">
                      {isLoading && (
                        <div className="py-12 flex flex-col items-center justify-center gap-3 text-orange-500">
                          <Loader2 className="w-7 h-7 animate-spin" />
                          <span className="text-xs font-semibold text-zinc-400">
                            Lade alle Details, Splits und Sensordaten von Strava...
                          </span>
                        </div>
                      )}

                      {errorMsg && (
                        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                            <span>{errorMsg}</span>
                          </div>
                          <button
                            onClick={() => fetchActivityDetails(act.stravaId)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-500 transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Wiederholen</span>
                          </button>
                        </div>
                      )}

                      {!isLoading && !errorMsg && detail && (
                        <ActivityDetailCard
                          detail={detail}
                          onOpenModal={() => {
                            setModalDetail(detail);
                            setIsModalOpen(true);
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen Modal View */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-2xl relative flex flex-col">
            {/* Modal Header */}
            <div className="sticky top-0 z-20 bg-zinc-900/95 backdrop-blur-md px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-600/15 text-orange-400 border border-orange-500/30">
                  <Flame className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    {modalDetail ? modalDetail.name : 'Aktivitäts-Vollansicht'}
                  </h3>
                  {modalDetail && (
                    <span className="text-xs text-zinc-400">
                      {new Date(modalDetail.startDate).toLocaleDateString('de-DE', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Schließen (ESC)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6">
              {!modalDetail ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-orange-500">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-sm font-semibold text-zinc-400">
                    Lade vollständige Strava-Analyse...
                  </span>
                </div>
              ) : (
                <ActivityDetailCard detail={modalDetail} isModal={true} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
