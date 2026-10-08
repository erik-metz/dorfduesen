'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, ExternalLink, Trophy, X, ChevronRight } from 'lucide-react';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  metadata?: {
    titleId?: string;
    championTitle?: string;
    icon?: string;
    previousValue?: number;
    newValue?: number;
    formattedValue?: string;
    overtakenByUserId?: string;
    overtakenByName?: string;
  } | null;
  createdAt: string;
}

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
  if (diffDays === 1) return 'gestern';
  if (diffDays < 7) return `vor ${diffDays} Tagen`;

  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      }
    } catch {
      // Ignore background fetch errors
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Poll every 30s
    const interval = setInterval(fetchNotifications, 30000);

    // Listen for custom trigger event
    const handleRefresh = () => fetchNotifications();
    window.addEventListener('dorfdusen-refresh-notifications', handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('dorfdusen-refresh-notifications', handleRefresh);
    };
  }, []);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const markAllAsRead = async () => {
    setLoading(true);
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const markOneAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-full border transition-all cursor-pointer ${
          unreadCount > 0
            ? 'bg-orange-950/40 border-orange-500/50 text-orange-400 hover:bg-orange-900/50 hover:border-orange-500'
            : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
        }`}
        aria-label="Benachrichtigungen"
        title="Benachrichtigungen"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white ring-2 ring-zinc-950 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-zinc-900/98 backdrop-blur-2xl border border-zinc-800 shadow-2xl shadow-black/80 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 px-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Benachrichtigungen
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  {unreadCount} neu
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={loading}
                className="text-[11px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Alle gelesen</span>
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-zinc-800/50">
            {notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-zinc-800/50 border border-zinc-700/40 text-zinc-400 mx-auto flex items-center justify-center text-xl">
                  🌾
                </div>
                <div className="text-xs font-bold text-zinc-300">Alles ruhig im Ried!</div>
                <p className="text-[11px] text-zinc-500">
                  Keine neuen Benachrichtigungen. Hol dir einen Arena-Wochentitel!
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const isLost = item.type === 'TITLE_LOST';
                const isGained = item.type === 'TITLE_GAINED';

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (!item.isRead) markOneAsRead(item.id);
                    }}
                    className={`p-3.5 sm:p-4 transition-colors flex items-start gap-3 text-left group ${
                      !item.isRead
                        ? 'bg-orange-500/5 hover:bg-orange-500/10'
                        : 'hover:bg-zinc-800/50'
                    }`}
                  >
                    {/* Icon Column */}
                    <div className="shrink-0 mt-0.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg border shadow-sm ${
                          isLost
                            ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                            : isGained
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        }`}
                      >
                        {item.metadata?.icon || (isLost ? '⛰️' : '🏆')}
                      </div>
                    </div>

                    {/* Content Column */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isLost
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : isGained
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {isLost ? 'Titel abgenommen' : isGained ? 'Titel geholt' : 'Info'}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>

                      <h4 className="text-xs font-black text-white leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                        {item.message}
                      </p>

                      {/* Link to Arena */}
                      {item.link && (
                        <div className="mt-2.5">
                          <Link
                            href={item.link}
                            onClick={() => {
                              if (!item.isRead) markOneAsRead(item.id);
                              setIsOpen(false);
                            }}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-orange-400 hover:text-orange-300 transition-colors"
                          >
                            <span>Zur Düsen-Arena</span>
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Unread dot */}
                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer CTA */}
          <div className="p-3 bg-zinc-950/80 border-t border-zinc-800/80 text-center">
            <Link
              href="/arena"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-orange-400 hover:text-orange-300 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Alle Wochentitel & Leaderboard anzeigen</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
