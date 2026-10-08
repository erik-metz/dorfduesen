'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, AlertCircle, X, Flame, ChevronRight } from 'lucide-react';

function ToastContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [activeAlert, setActiveAlert] = useState<{
    id: string;
    title: string;
    message: string;
    icon: string;
    link: string;
  } | null>(null);

  const login = searchParams.get('login');
  const logout = searchParams.get('logout');
  const error = searchParams.get('auth_error');

  // Compute toast status during render for URL query params
  let urlToast: { type: 'success' | 'error'; message: string } | null = null;
  if (!dismissed) {
    if (login === 'success') {
      urlToast = {
        type: 'success',
        message: 'Erfolgreich mit Strava verbunden! Deine Aktivitäten werden synchronisiert.',
      };
    } else if (logout === 'success') {
      urlToast = {
        type: 'success',
        message: 'Du wurdest erfolgreich abgemeldet.',
      };
    } else if (error) {
      urlToast = {
        type: 'error',
        message: `Strava-Verbindung fehlgeschlagen (${error}). Bitte versuche es erneut.`,
      };
    }
  }

  useEffect(() => {
    if (login || logout) {
      const timer = setTimeout(() => {
        const params = new URLSearchParams(window.location.search);
        params.delete('login');
        params.delete('logout');
        const qs = params.toString();
        router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { scroll: false });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [login, logout, router]);

  // Check for unread TITLE_LOST overtake notifications when no URL toast is active
  useEffect(() => {
    if (login || logout || error) return;

    fetch('/api/notifications')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && Array.isArray(data?.notifications) && data.notifications.length > 0) {
          // Find first unread TITLE_LOST notification
          const titleLost = data.notifications.find(
            (n: { isRead: boolean; type: string }) => !n.isRead && n.type === 'TITLE_LOST'
          );
          if (titleLost) {
            setActiveAlert({
              id: titleLost.id,
              title: titleLost.title,
              message: titleLost.message,
              icon: titleLost.metadata?.icon || '⛰️',
              link: titleLost.link || '/arena',
            });
          }
        }
      })
      .catch(() => {});
  }, [login, logout, error]);

  const handleDismissAlert = async () => {
    if (activeAlert) {
      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationId: activeAlert.id }),
        });
      } catch {}
      setActiveAlert(null);
    }
    setDismissed(true);
  };

  if (dismissed) return null;

  // Render URL query-param Toast
  if (urlToast) {
    return (
      <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in slide-in-from-bottom-5 duration-300">
        <div
          className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-md ${
            urlToast.type === 'success'
              ? 'bg-zinc-900/95 border-emerald-500/40 text-zinc-100 shadow-emerald-950/20'
              : 'bg-zinc-900/95 border-rose-500/40 text-zinc-100 shadow-rose-950/20'
          }`}
        >
          <div className="mt-0.5 shrink-0">
            {urlToast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400" />
            )}
          </div>
          <div className="flex-1 text-sm leading-snug">
            <div className="font-bold flex items-center gap-1.5 mb-0.5">
              {urlToast.type === 'success' ? (
                <>
                  <span>Dorfdüsen Status</span>
                  <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                </>
              ) : (
                <span>Hinweis</span>
              )}
            </div>
            <p className="text-zinc-300 text-xs sm:text-sm">{urlToast.message}</p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg cursor-pointer"
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Render Title Overtaken Alert Toast
  if (activeAlert) {
    return (
      <div className="fixed bottom-6 right-6 z-50 max-w-md w-full px-4 sm:px-0 animate-in slide-in-from-bottom-5 duration-300">
        <div className="p-4 rounded-3xl shadow-2xl border border-rose-500/40 bg-zinc-900/95 backdrop-blur-xl text-zinc-100 shadow-rose-950/40 ring-1 ring-rose-500/20">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-xl shrink-0">
              {activeAlert.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  Arena Alarm
                </span>
              </div>
              <h4 className="text-sm font-black text-white leading-snug">
                {activeAlert.title}
              </h4>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                {activeAlert.message}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Link
                  href={activeAlert.link}
                  onClick={handleDismissAlert}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-600/30 transition-all cursor-pointer"
                >
                  <span>Revanche in der Arena</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={handleDismissAlert}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  Später
                </button>
              </div>
            </div>
            <button
              onClick={handleDismissAlert}
              className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg cursor-pointer shrink-0"
              aria-label="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export function NotificationToast() {
  return (
    <Suspense fallback={null}>
      <ToastContent />
    </Suspense>
  );
}
