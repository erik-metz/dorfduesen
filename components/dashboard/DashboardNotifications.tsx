'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCheck,
  Check,
  ChevronRight,
  Trophy,
  Award,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { NotificationItem, NotificationMetadata } from '@/types/notification';

interface DashboardNotificationsProps {
  initialNotifications?: NotificationItem[];
  onTabChange?: (tab: 'activities' | 'trophies' | 'coach' | 'notifications') => void;
}

type FilterType = 'all' | 'unread' | 'arena' | 'badges';

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'gerade eben';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return `gestern, ${time} Uhr`;
  }
  if (diffDays < 7) return `vor ${diffDays} Tagen`;

  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getNotificationConfig(type: string, metadata?: NotificationMetadata | null) {
  switch (type) {
    case 'TITLE_LOST':
      return {
        label: 'Titel abgenommen',
        badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
        borderClass: 'border-rose-500/40 hover:border-rose-500/70',
        bgClass: 'bg-gradient-to-br from-rose-950/25 via-zinc-900/90 to-zinc-900',
        iconBg: 'bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-rose-500/10',
        defaultIcon: '⛰️',
        actionLabel: 'Zur Arena & Titel zurückholen',
        defaultLink: '/arena',
      };
    case 'TITLE_GAINED':
      return {
        label: 'Führung übernommen',
        badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        borderClass: 'border-amber-500/40 hover:border-amber-500/70',
        bgClass: 'bg-gradient-to-br from-amber-950/25 via-zinc-900/90 to-zinc-900',
        iconBg: 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-amber-500/10',
        defaultIcon: '👑',
        actionLabel: 'Zur Arena ansehen',
        defaultLink: '/arena',
      };
    case 'WEEKLY_CHAMPION':
      return {
        label: 'Wochensieger',
        badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
        borderClass: 'border-yellow-500/40 hover:border-yellow-500/70',
        bgClass: 'bg-gradient-to-br from-yellow-950/25 via-zinc-900/90 to-zinc-900',
        iconBg: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300 shadow-yellow-500/10',
        defaultIcon: '🏆',
        actionLabel: 'Im Trophäenschrank ansehen',
        defaultLink: '/dashboard?tab=trophies',
      };
    case 'MONTHLY_CHAMPION':
      return {
        label: 'Monats-König',
        badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
        borderClass: 'border-orange-500/40 hover:border-orange-500/70',
        bgClass: 'bg-gradient-to-br from-orange-950/25 via-zinc-900/90 to-zinc-900',
        iconBg: 'bg-orange-500/20 border-orange-500/40 text-orange-300 shadow-orange-500/10',
        defaultIcon: '🌟',
        actionLabel: 'Im Trophäenschrank ansehen',
        defaultLink: '/dashboard?tab=trophies',
      };
    case 'BADGE_UNLOCKED': {
      const isLevelUp = metadata?.level && metadata.level > 1;
      return {
        label: isLevelUp ? `Badge Level-Up (Stufe ${metadata.level})` : 'Neues Badge freigeschaltet',
        badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        borderClass: 'border-purple-500/40 hover:border-purple-500/70',
        bgClass: 'bg-gradient-to-br from-purple-950/25 via-zinc-900/90 to-zinc-900',
        iconBg: 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-purple-500/10',
        defaultIcon: '🏅',
        actionLabel: 'In der Vitrine ansehen',
        defaultLink: '/dashboard?tab=trophies',
      };
    }
    default:
      return {
        label: 'Mitteilung',
        badgeClass: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        borderClass: 'border-zinc-800 hover:border-zinc-700',
        bgClass: 'bg-zinc-900/60',
        iconBg: 'bg-zinc-800 border-zinc-700 text-zinc-300',
        defaultIcon: '📢',
        actionLabel: 'Details ansehen',
        defaultLink: null,
      };
  }
}

export function DashboardNotifications({
  initialNotifications = [],
  onTabChange,
}: DashboardNotificationsProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const fetchLatest = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
        }
      }
    } catch (e) {
      console.error('Fehler beim Laden der Benachrichtigungen:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // If we had no initial notifications, load on mount
    const initialFetch = initialNotifications.length === 0 ? setTimeout(fetchLatest, 0) : undefined;

    // Auto-poll every 30 seconds
    const interval = setInterval(fetchLatest, 30000);

    // Sync with navbar or other components
    const handleRefresh = () => fetchLatest();
    window.addEventListener('dorfdusen-refresh-notifications', handleRefresh);

    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
      window.removeEventListener('dorfdusen-refresh-notifications', handleRefresh);
    };
  }, [fetchLatest, initialNotifications.length]);

  const markOneAsRead = async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      // Notify other components (Navbar bell, etc.)
      window.dispatchEvent(new CustomEvent('dorfdusen-refresh-notifications'));
    } catch (e) {
      console.error('Fehler beim Markieren:', e);
    }
  };

  const markAllAsRead = async () => {
    if (isMarkingAll) return;
    setIsMarkingAll(true);

    // Optimistic update
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      window.dispatchEvent(new CustomEvent('dorfdusen-refresh-notifications'));
    } catch (e) {
      console.error('Fehler beim Markieren aller Benachrichtigungen:', e);
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Stats
  const totalCount = notifications.length;
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const arenaCount = notifications.filter((n) =>
    ['TITLE_LOST', 'TITLE_GAINED', 'WEEKLY_CHAMPION'].includes(n.type)
  ).length;
  const badgeCount = notifications.filter((n) =>
    ['BADGE_UNLOCKED', 'MONTHLY_CHAMPION'].includes(n.type)
  ).length;

  // Filtered items
  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'unread') return !item.isRead;
    if (filter === 'arena') {
      return ['TITLE_LOST', 'TITLE_GAINED', 'WEEKLY_CHAMPION'].includes(item.type);
    }
    if (filter === 'badges') {
      return ['BADGE_UNLOCKED', 'MONTHLY_CHAMPION'].includes(item.type);
    }
    return true;
  });

  const handleActionClick = (item: NotificationItem, targetLink: string) => {
    if (!item.isRead) {
      markOneAsRead(item.id);
    }

    // If it's a tab link and we have onTabChange handler, switch tab directly
    if (targetLink.includes('tab=trophies') && onTabChange) {
      onTabChange('trophies');
    } else if (targetLink.includes('tab=coach') && onTabChange) {
      onTabChange('coach');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="rounded-3xl bg-gradient-to-r from-orange-950/40 via-zinc-900/90 to-zinc-900 border border-orange-500/20 p-6 sm:p-8 relative overflow-hidden shadow-xl shadow-black/40">
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-black uppercase tracking-wider">
              <Bell className="w-3.5 h-3.5" />
              <span>Benachrichtigungszentrale</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Aktivitäts- & Arena-Updates
            </h2>
            <p className="text-sm text-zinc-300 max-w-2xl leading-relaxed">
              Erfahre sofort, wenn dir jemand im Ried einen Wochentitel streitig macht, du ein neues
              Abzeichen in deiner Vitrine freischaltest oder neue Herausforderungen warten.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={isMarkingAll}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                <span>{isMarkingAll ? 'Markiere...' : 'Alle gelesen'}</span>
              </button>
            )}

            <button
              onClick={fetchLatest}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-lg shadow-orange-500/20 cursor-pointer disabled:opacity-50"
              title="Aktualisieren"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Aktualisieren</span>
            </button>
          </div>
        </div>

        {/* Counter Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-zinc-800/80">
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Gesamt
            </div>
            <div className="text-xl sm:text-2xl font-black text-white mt-0.5">{totalCount}</div>
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
              Ungelesen
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-400 mt-0.5">
              {unreadCount}
            </div>
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Arena & Titel
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-300 mt-0.5">{arenaCount}</div>
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
              Badges
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-300 mt-0.5">{badgeCount}</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              filter === 'all'
                ? 'bg-zinc-200 text-zinc-950 shadow-md'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <span>Alle</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20">
              {totalCount}
            </span>
          </button>

          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              filter === 'unread'
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <span>Ungelesen</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/30 font-black">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilter('arena')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              filter === 'arena'
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Arena & Titel</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20">
              {arenaCount}
            </span>
          </button>

          <button
            onClick={() => setFilter('badges')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              filter === 'badges'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Badges</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20">
              {badgeCount}
            </span>
          </button>
        </div>

        <div className="text-xs text-zinc-500 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>Synchronisiert mit Strava & Arena</span>
        </div>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="rounded-3xl bg-zinc-900/50 border border-zinc-800/80 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 text-3xl mx-auto flex items-center justify-center shadow-inner">
            {filter === 'unread' ? '✨' : '🌾'}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-white">
              {filter === 'unread'
                ? 'Alles gelesen – Keine neuen Benachrichtigungen!'
                : 'Keine Einträge gefunden'}
            </h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              {filter === 'unread'
                ? 'Du bist auf dem aktuellen Stand. Sobald sich etwas auf der Rangliste oder bei deinen Badges tut, siehst du es hier.'
                : 'Sammle Kilometer auf Strava, nimm an der Arena teil oder sichere dir Wochentitel, um Benachrichtigungen zu erhalten.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((item) => {
            const config = getNotificationConfig(item.type, item.metadata);
            const targetLink = item.link || config.defaultLink;
            const iconDisplay = item.metadata?.icon || config.defaultIcon;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-all duration-150 p-4 sm:p-5 relative ${
                  item.isRead
                    ? 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                    : `${config.bgClass} ${config.borderClass} shadow-lg shadow-black/20`
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    {/* Icon */}
                    <div
                      className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl shrink-0 ${
                        item.isRead
                          ? 'bg-zinc-800/80 border-zinc-700/80 text-zinc-400'
                          : config.iconBg
                      }`}
                    >
                      {iconDisplay}
                    </div>

                    {/* Content */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${config.badgeClass}`}
                        >
                          {config.label}
                        </span>

                        {!item.isRead && (
                          <span className="flex items-center gap-1 text-[10px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            Neu
                          </span>
                        )}

                        <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatRelativeTime(item.createdAt)}</span>
                        </span>
                      </div>

                      <h4
                        className={`text-sm sm:text-base font-black leading-snug ${
                          item.isRead ? 'text-zinc-200' : 'text-white'
                        }`}
                      >
                        {item.title}
                      </h4>

                      <p
                        className={`text-xs leading-relaxed max-w-3xl ${
                          item.isRead ? 'text-zinc-400' : 'text-zinc-300'
                        }`}
                      >
                        {item.message}
                      </p>

                      {/* Extra metadata chips */}
                      {item.metadata?.overtakenByName && (
                        <div className="pt-1 flex items-center gap-2">
                          <span className="text-[11px] bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded-lg font-bold">
                            Überholt von: {item.metadata.overtakenByName}
                            {item.metadata.formattedValue && ` (${item.metadata.formattedValue})`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/60">
                    {!item.isRead && (
                      <button
                        onClick={() => markOneAsRead(item.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-semibold transition-colors cursor-pointer"
                        title="Als gelesen markieren"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="hidden sm:inline">Gelesen</span>
                      </button>
                    )}

                    {targetLink && (
                      <Link
                        href={targetLink}
                        onClick={() => handleActionClick(item, targetLink)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold transition-all hover:border-orange-500/50"
                      >
                        <span>{config.actionLabel}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
