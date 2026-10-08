import React, { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import { Flame, Sparkles, ShieldCheck, Zap, ArrowLeft, Loader2 } from 'lucide-react';
import { getClubData } from '@/lib/data/club';
import { getCurrentUser } from '@/lib/auth/session';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { CoachDashboard } from '@/components/coach/CoachDashboard';
import { StravaIcon } from '@/components/icons/BrandIcons';
import { NotificationToast } from '@/components/NotificationToast';

export const metadata = {
  title: 'Smart Coach | Dorfdüsen KI-Trainingspläne',
  description:
    'Personalisierte Trainingspläne mit xAI Grok und Inngest: VDOT-Paceberechnungen, Herzfrequenzzonen und adaptive Auswertung deiner Strava-Läufe.',
};

function CoachSkeleton() {
  return (
    <div className="py-24 text-center text-zinc-500">
      <div className="flex items-center justify-center gap-3 text-orange-500 font-bold">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Lade Smart Coach...</span>
      </div>
    </div>
  );
}

export default async function CoachPage() {
  const club = await getClubData();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-orange-600 selection:text-white">
      {/* Navbar */}
      <Navbar club={club} />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<CoachSkeleton />}>
          <CoachContent />
        </Suspense>
      </main>

      {/* Toast notifications */}
      <NotificationToast />

      {/* Footer */}
      <Footer club={club} />
    </div>
  );
}

async function CoachContent() {
  await connection();
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 rounded-3xl bg-zinc-900 border border-zinc-800 p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-orange-600/15 border border-orange-500/30 text-orange-500 mx-auto flex items-center justify-center text-3xl shadow-lg shadow-orange-600/20">
          <Sparkles className="w-8 h-8 text-orange-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
            Smart Coach Login
          </h1>
          <p className="text-sm text-zinc-400">
            Verbinde deinen Strava-Account, damit die Sport-Engine deine Herzfrequenz, Paces und bisherigen Läufe für deinen maßgeschneiderten Plan analysieren kann.
          </p>
        </div>

        <div className="space-y-3 py-2 text-left text-xs text-zinc-300">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Automatische VDOT- & Pulszonen-Berechnung</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Hintergrund-Generierung via Inngest & xAI Grok</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Flame className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Abgleich deiner realen Läufe gegen das Trainingssoll</span>
          </div>
        </div>

        <div className="pt-2 space-y-3">
          <a
            href="/api/auth/strava/login"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold bg-[#fc5200] hover:bg-[#e04800] text-white shadow-xl shadow-[#fc5200]/30 transition-all text-sm group"
          >
            <StravaIcon className="w-5 h-5" />
            <span>Mit Strava verbinden</span>
          </a>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors pt-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Zurück zur Startseite</span>
          </Link>
        </div>
      </div>
    );
  }

  return <CoachDashboard />;
}
