import React, { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import { ArrowLeft, Flame, ShieldCheck, Zap } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { DashboardView } from '@/components/DashboardView';
import { StravaIcon } from '@/components/icons/BrandIcons';
import { NotificationToast } from '@/components/NotificationToast';

export const metadata = {
  title: 'Athleten Dashboard | Dorfdüsen Nordheim',
  description: 'Verwalte deine Strava-Aktivitäten und verfolge deine Kilometer mit den Dorfdüsen.',
};

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
      <div className="flex items-center gap-3 text-orange-500 font-bold">
        <Flame className="w-6 h-6 animate-pulse fill-orange-500" />
        <span>Lade Dorfdüsen Dashboard...</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  await connection();
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center px-4 py-16 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-orange-600/15 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-md w-full rounded-3xl bg-zinc-900 border border-zinc-800 p-8 shadow-2xl text-center space-y-6 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-orange-600/15 border border-orange-500/30 text-orange-500 mx-auto flex items-center justify-center text-3xl shadow-lg shadow-orange-600/20">
            <Flame className="w-8 h-8 fill-orange-500 text-orange-500" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
              Dorfdüsen Login
            </h1>
            <p className="text-sm text-zinc-400">
              Verbinde dich mit Strava, um deine Läufe und Fahrten automatisch zu synchronisieren und Teil der Community zu werden.
            </p>
          </div>

          <div className="space-y-3 py-2 text-left text-xs text-zinc-300">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Sicherer OAuth 2.0 Login über Strava</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Automatische Aktivitäten-Synchronisation</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Flame className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Kostenlos und jederzeit trennbar</span>
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <a
              href="/api/auth/strava/login"
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold bg-[#fc5200] hover:bg-[#e04800] text-white shadow-xl shadow-[#fc5200]/30 transition-all text-sm group"
            >
              <StravaIcon className="w-5 h-5" />
              <span>Mit Strava anmelden</span>
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
      </div>
    );
  }

  // User ist angemeldet -> Hole Aktivitäten aus der DB
  const rawActivities = await db.activity.findMany({
    where: { userId: user.id },
    orderBy: { startDate: 'desc' },
    take: 100,
  });

  const activities = rawActivities.map((act) => ({
    id: act.id,
    stravaId: act.stravaId,
    name: act.name,
    distance: act.distance,
    movingTime: act.movingTime,
    totalElevationGain: act.totalElevationGain,
    sportType: act.sportType,
    startDate: act.startDate.toISOString(),
    averageSpeed: act.averageSpeed,
    kudosCount: act.kudosCount,
    summaryPolyline: act.summaryPolyline,
    averageHeartrate: act.averageHeartrate,
    maxSpeed: act.maxSpeed,
  }));

  // Aggregierte Statistiken
  const totalDistanceMeters = activities.reduce((sum, a) => sum + a.distance, 0);
  const totalSeconds = activities.reduce((sum, a) => sum + a.movingTime, 0);
  const totalElevation = activities.reduce((sum, a) => sum + a.totalElevationGain, 0);

  const stats = {
    totalDistanceKm: totalDistanceMeters / 1000,
    totalHours: totalSeconds / 3600,
    totalElevation,
    activityCount: activities.length,
  };

  const lastSync = user.account?.updatedAt ? user.account.updatedAt.toISOString() : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <DashboardView
        user={{
          id: user.id,
          firstname: user.firstname,
          lastname: user.lastname,
          username: user.username,
          profile: user.profile,
          city: user.city,
          country: user.country,
          stravaAthleteId: user.stravaAthleteId,
        }}
        activities={activities}
        stats={stats}
        lastSync={lastSync}
      />
      <NotificationToast />
    </div>
  );
}
