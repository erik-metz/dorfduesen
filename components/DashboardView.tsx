'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
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
  Sparkles,
  Trophy,
  Bell,
  ChevronRight,
  Eye,
  Users,
  Lock,
} from 'lucide-react';
import { StravaIcon } from '@/components/icons/BrandIcons';
import { polylineToSvgPath } from '@/lib/strava/polyline';
import { isValidAvatarUrl } from '@/lib/utils/avatar';
import { ActivityDetailData } from '@/lib/strava/activity-detail';
import { ActivityDetailCard } from '@/components/strava/ActivityDetailCard';
import { CoachDashboard } from '@/components/coach/CoachDashboard';
import { TrophyCabinet } from '@/components/trophies/TrophyCabinet';
import { DashboardNotifications } from '@/components/dashboard/DashboardNotifications';
import { NotificationItem } from '@/types/notification';

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

export interface MemberPreview {
  id: string;
  name: string;
  firstname: string | null;
  lastname: string | null;
  username: string | null;
  profile: string | null;
  stravaAthleteId: string;
  city: string | null;
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
  currentUser?: {
    id: string;
    name: string;
    profile: string | null;
  };
  allMembers?: MemberPreview[];
  isReadOnly?: boolean;
  activities: ActivityItem[];
  pagination: { page: number; pageCount: number; pageSize: number; filteredCount: number; sport: string };
  stats: {
    totalDistanceKm: number;
    totalHours: number;
    totalElevation: number;
    activityCount: number;
  };
  initialNotifications?: NotificationItem[];
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

export function DashboardView({
  user,
  currentUser,
  allMembers = [],
  isReadOnly = false,
  activities,
  stats,
  pagination,
  initialNotifications = [],
}: DashboardViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  type MainTab = 'activities' | 'trophies' | 'coach' | 'notifications';

  const tabParam = searchParams.get('tab');
  const mainTab: MainTab =
    tabParam === 'coach'
      ? 'coach'
      : tabParam === 'trophies'
      ? 'trophies'
      : tabParam === 'notifications' && !isReadOnly
      ? 'notifications'
      : 'activities';

  const handleTabChange = (newTab: MainTab) => {
    if (tabParam === newTab) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const unreadCount = isReadOnly ? 0 : notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    if (isReadOnly) return;
    const handleRefresh = async () => {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && Array.isArray(data.notifications)) {
            setNotifications(data.notifications);
          }
        }
      } catch {}
    };

    window.addEventListener('dorfdusen-refresh-notifications', handleRefresh);
    return () => window.removeEventListener('dorfdusen-refresh-notifications', handleRefresh);
  }, [isReadOnly]);

  const filterSport = pagination.sport;
  const activityHref = (page: number, sport = filterSport, pageSize = pagination.pageSize) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('activityPage', String(page));
    params.set('activitySport', sport);
    params.set('activityPageSize', String(pageSize));
    params.set('tab', 'activities');
    return `${pathname}?${params.toString()}`;
  };
  const setFilterSport = (sport: string) => router.push(activityHref(1, sport), { scroll: false });
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

  const filteredActivities = activities;

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
          {isReadOnly && (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/40 text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Mein Profil</span>
            </Link>
          )}
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

      {/* Read-Only Notice Banner */}
      {isReadOnly && (
        <div className="rounded-3xl bg-gradient-to-r from-orange-950/70 via-zinc-900 to-zinc-900 border border-orange-500/40 p-5 sm:p-6 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-600/20 border border-orange-500/40 text-orange-400 flex items-center justify-center shrink-0">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-600/30 text-orange-300 border border-orange-500/40">
                  Nur-Lese-Modus
                </span>
                <span className="text-xs text-zinc-400">
                  Keine Änderungen möglich
                </span>
              </div>
              <p className="text-sm font-semibold text-white mt-1">
                Du betrachtest die Daten und Aktivitäten von <strong className="text-orange-400">{displayName}</strong>.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-lg shadow-orange-600/20 shrink-0 self-start sm:self-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Zurück zu meinem Dashboard</span>
          </Link>
        </div>
      )}

      {/* Team Member Switcher */}
      {allMembers && allMembers.length > 0 && (
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
              <Users className="w-4 h-4 text-orange-400" />
              <span>Dorfdüsen Team ({allMembers.length} Athleten)</span>
            </div>
            <span className="text-[11px] text-zinc-500 hidden sm:inline">
              Klicke auf einen Athleten, um dessen Aktivitäten im Nur-Lese-Modus anzusehen
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {allMembers.map((member) => {
              const isSelected = member.id === user.id;
              const isMe = currentUser && member.id === currentUser.id;
              const href = isMe ? '/dashboard' : `/dashboard?userId=${member.id}`;
              return (
                <Link
                  key={member.id}
                  href={href}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                    isSelected
                      ? 'bg-orange-600 text-white border-orange-500 shadow-md shadow-orange-600/20'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:text-white'
                  }`}
                  title={`${member.name}${isMe ? ' (Du)' : ''}`}
                >
                  <div className="relative w-5 h-5 rounded-full overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700">
                    {isValidAvatarUrl(member.profile) ? (
                      <Image src={member.profile!} alt={member.name} fill unoptimized className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-orange-400 font-bold">
                        {member.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <span className="max-w-[120px] truncate">{member.name}</span>
                  {isMe && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/30 text-zinc-300 font-normal">
                      Du
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

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

          {isReadOnly && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs font-medium text-zinc-400 shadow-inner">
              <Eye className="w-3.5 h-3.5 text-orange-400" />
              <span>Nur-Lese-Ansicht</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Tabs (Aktivitäten vs. Trophäenschrank vs. Smart Coach vs. Benachrichtigungen) */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => handleTabChange('activities')}
          className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2.5 cursor-pointer shrink-0 ${
            mainTab === 'activities'
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
              : 'text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800'
          }`}
        >
          <Footprints className="w-4 h-4" />
          <span>Aktivitäten & Statistik</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-black/20 text-zinc-300">
            {stats.activityCount}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('trophies')}
          className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2.5 cursor-pointer shrink-0 ${
            mainTab === 'trophies'
              ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
              : 'text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-300" />
          <span>Trophäenschrank</span>
          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-600/30 text-amber-300 border border-amber-500/30">
            Vitrine
          </span>
        </button>

        <button
          onClick={() => handleTabChange('coach')}
          className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2.5 cursor-pointer shrink-0 ${
            mainTab === 'coach'
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
              : 'text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800'
          }`}
        >
          {isReadOnly ? (
            <Lock className="w-4 h-4 text-zinc-400" />
          ) : (
            <Sparkles className="w-4 h-4 text-orange-400" />
          )}
          <span>Smart Coach</span>
          {isReadOnly ? (
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
              Privat
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-600 text-white">
              KI
            </span>
          )}
        </button>

        {!isReadOnly && (
          <button
            onClick={() => handleTabChange('notifications')}
            className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2.5 cursor-pointer shrink-0 ${
              mainTab === 'notifications'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Benachrichtigungen</span>
            {unreadCount > 0 ? (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                {unreadCount} neu
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-black/20 text-zinc-300">
                {notifications.length}
              </span>
            )}
          </button>
        )}
      </div>

      {mainTab === 'coach' ? (
        isReadOnly ? (
          <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-orange-600/15 border border-orange-500/30 text-orange-400 mx-auto flex items-center justify-center">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">
              Smart Coach ist privat
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Persönliche KI-Trainingspläne, Gesundheitsmetriken und Ruhepulsdaten sind geschützt und nur für den Athleten selbst einsehbar.
            </p>
            <Link
              href="/dashboard?tab=coach"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-lg shadow-orange-600/20"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Zu deinem eigenen Smart Coach</span>
            </Link>
          </div>
        ) : (
          <CoachDashboard />
        )
      ) : mainTab === 'trophies' ? (
        <TrophyCabinet userId={user.id} isReadOnly={isReadOnly} />
      ) : mainTab === 'notifications' && !isReadOnly ? (
        <DashboardNotifications
          initialNotifications={notifications}
          onTabChange={handleTabChange}
        />
      ) : (
        <>
          {/* Unread Notifications Alert Banner on Activities Tab */}
          {unreadCount > 0 && !isReadOnly && (
            <div className="rounded-2xl bg-gradient-to-r from-orange-950/40 via-zinc-900 to-zinc-900 border border-orange-500/30 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-black/20">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-orange-400">
                      {unreadCount} {unreadCount === 1 ? 'neue Benachrichtigung' : 'neue Benachrichtigungen'}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  </div>
                  <p className="text-xs text-zinc-300 truncate max-w-xl">
                    {notifications.find((n) => !n.isRead)?.title || 'Neue Updates in der Arena oder bei deinen Badges.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => handleTabChange('notifications')}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-md shadow-orange-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Anzeigen</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

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
              Alle ({stats.activityCount})
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

        <nav aria-label="Aktivitätenseiten" className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-zinc-400">
            {pagination.filteredCount === 0 ? '0 Aktivitäten' : `${(pagination.page - 1) * pagination.pageSize + 1}–${(pagination.page - 1) * pagination.pageSize + activities.length} von ${pagination.filteredCount} Aktivitäten`}
          </span>
          <label className="flex items-center gap-2 text-zinc-400">
            Pro Seite
            <select
              value={pagination.pageSize}
              onChange={(event) => router.push(activityHref(1, filterSport, Number(event.target.value)), { scroll: false })}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus-visible:outline-2 focus-visible:outline-orange-500"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <div className="flex items-center gap-4">
            {pagination.page > 1 && <Link href={activityHref(pagination.page - 1)} scroll={false} className="font-bold text-orange-400 hover:underline">Zurück</Link>}
            <span className="text-zinc-400">Seite {pagination.page} / {pagination.pageCount}</span>
            {pagination.page < pagination.pageCount && <Link href={activityHref(pagination.page + 1)} scroll={false} className="font-bold text-orange-400 hover:underline">Weiter</Link>}
          </div>
        </nav>

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
        </>
      )}

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
