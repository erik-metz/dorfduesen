'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

export function ArenaRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        startTransition(() => router.refresh());
      }
    };
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [router]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-400">
      <span>Automatische Aktualisierung jede Minute · synchronisierte Strava-Aktivitäten</span>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => router.refresh())}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-orange-400 hover:bg-zinc-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-orange-400"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
        {isPending ? 'Aktualisiert …' : 'Aktualisieren'}
      </button>
    </div>
  );
}
