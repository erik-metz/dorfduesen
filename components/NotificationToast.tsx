'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle, X, Flame } from 'lucide-react';

function ToastContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  const login = searchParams.get('login');
  const logout = searchParams.get('logout');
  const error = searchParams.get('auth_error');

  // Compute toast status during render (pure calculation, no synchronous setState in effect)
  let toast: { type: 'success' | 'error'; message: string } | null = null;
  if (!dismissed) {
    if (login === 'success') {
      toast = {
        type: 'success',
        message: 'Erfolgreich mit Strava verbunden! Deine Aktivitäten werden synchronisiert.',
      };
    } else if (logout === 'success') {
      toast = {
        type: 'success',
        message: 'Du wurdest erfolgreich abgemeldet.',
      };
    } else if (error) {
      toast = {
        type: 'error',
        message: `Strava-Verbindung fehlgeschlagen (${error}). Bitte versuche es erneut.`,
      };
    }
  }

  useEffect(() => {
    if (login || logout) {
      const timer = setTimeout(() => {
        router.replace(window.location.pathname);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [login, logout, router]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in slide-in-from-bottom-5 duration-300">
      <div
        className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-md ${
          toast.type === 'success'
            ? 'bg-zinc-900/95 border-emerald-500/40 text-zinc-100 shadow-emerald-950/20'
            : 'bg-zinc-900/95 border-rose-500/40 text-zinc-100 shadow-rose-950/20'
        }`}
      >
        <div className="mt-0.5 shrink-0">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          )}
        </div>
        <div className="flex-1 text-sm leading-snug">
          <div className="font-bold flex items-center gap-1.5 mb-0.5">
            {toast.type === 'success' ? (
              <>
                <span>Dorfdüsen Status</span>
                <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
              </>
            ) : (
              <span>Hinweis</span>
            )}
          </div>
          <p className="text-zinc-300 text-xs sm:text-sm">{toast.message}</p>
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

export function NotificationToast() {
  return (
    <Suspense fallback={null}>
      <ToastContent />
    </Suspense>
  );
}
