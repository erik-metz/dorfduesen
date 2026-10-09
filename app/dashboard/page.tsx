import React, { Suspense } from 'react';
import Link from 'next/link';
import { after } from 'next/server';
import { ArrowLeft, Flame, ShieldCheck, Zap } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { getDashboardActivities } from '@/lib/data/dashboard';
import { queueDashboardSync } from '@/lib/strava/queue';
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

function isSyncCooldownExpired(lastSyncDate: Date | null | undefined): boolean {
  if (!lastSyncDate) return true;
  const AUTO_SYNC_COOLDOWN_MS = 60 * 1000;
  return Date.now() - lastSyncDate.getTime() > AUTO_SYNC_COOLDOWN_MS;
}

export default function DashboardPage(props: {
  searchParams: Promise<{ userId?: string; athleteId?: string; tab?: string; activityPage?: string; activitySport?: string; activityPageSize?: string }>;
}) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent searchParamsPromise={props.searchParams} />
    </Suspense>
  );
}

async function DashboardContent({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ userId?: string; athleteId?: string; tab?: string; activityPage?: string; activitySport?: string; activityPageSize?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
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

  // Alle registrierten Dorfdüsen-Mitglieder für die Schnell-Auswahl abrufen
  const rawMembers = await db.user.findMany({
    select: {
      id: true,
      firstname: true,
      lastname: true,
      username: true,
      profile: true,
      stravaAthleteId: true,
      city: true,
    },
    orderBy: [
      { firstname: 'asc' },
      { lastname: 'asc' },
    ],
  });

  const allMembers = rawMembers.map((m) => ({
    id: m.id,
    name: [m.firstname, m.lastname].filter(Boolean).join(' ') || m.username || 'Dorfdüse',
    firstname: m.firstname,
    lastname: m.lastname,
    username: m.username,
    profile: m.profile,
    stravaAthleteId: m.stravaAthleteId,
    city: m.city,
  }));

  // Bestimmen, welcher User angezeigt werden soll (eigener Account vs. anderes Mitglied)
  let targetUser = currentUser;
  let isReadOnly = false;

  if (searchParams.userId && searchParams.userId !== currentUser.id) {
    const foundUser = await db.user.findUnique({
      where: { id: searchParams.userId },
      include: {
        account: {
          select: {
            scope: true,
            expiresAt: true,
            updatedAt: true,
          },
        },
        _count: {
          select: {
            activities: true,
          },
        },
      },
    });
    if (foundUser) {
      targetUser = foundUser;
      isReadOnly = true;
    }
  } else if (searchParams.athleteId && searchParams.athleteId !== currentUser.stravaAthleteId) {
    const foundUser = await db.user.findUnique({
      where: { stravaAthleteId: searchParams.athleteId },
      include: {
        account: {
          select: {
            scope: true,
            expiresAt: true,
            updatedAt: true,
          },
        },
        _count: {
          select: {
            activities: true,
          },
        },
      },
    });
    if (foundUser) {
      targetUser = foundUser;
      isReadOnly = true;
    }
  }

  // Automatischer Sync beim Aufruf des Strava-Dashboards:
  // NUR für das eigene Profil des angemeldeten Benutzers! Fremde Profile werden rein passiv gelesen.
  if (!isReadOnly) {
    const lastSyncLog = await db.syncLog.findFirst({
      where: { userId: currentUser.id, status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
    });

    const shouldAutoSync = isSyncCooldownExpired(lastSyncLog?.createdAt);

    if (shouldAutoSync) {
      after(async () => {
        try {
          await queueDashboardSync(currentUser.id);
        } catch (syncErr) {
          console.error('Automatischer Strava-Hintergrund-Sync fehlgeschlagen:', syncErr);
        }
      });
    } else {
      after(async () => {
        try {
          const { evaluateUserBadges } = await import('@/lib/arena/badge-engine');
          await evaluateUserBadges(currentUser.id);
        } catch (badgeErr) {
          console.error('Fehler bei automatischer Badge-Auswertung im Dashboard:', badgeErr);
        }
      });
    }
  }

  // User ist angemeldet -> Hole Aktivitäten aus der DB
  const { activities: rawActivities, stats, pagination } = await getDashboardActivities(
    targetUser.id, searchParams.activityPage, searchParams.activitySport, searchParams.activityPageSize);

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
    detailData: null,
  }));

  // Benachrichtigungen: Nur für das eigene Profil laden, niemals für fremde Mitglieder
  let notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    link: string | null;
    isRead: boolean;
    metadata: import('@/types/notification').NotificationMetadata | null;
    createdAt: string;
  }> = [];

  if (!isReadOnly) {
    const rawNotifications = await db.notification.findMany({
      where: { userId: currentUser.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    notifications = rawNotifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link,
      isRead: n.isRead,
      metadata: n.metadata as import('@/types/notification').NotificationMetadata | null,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  const currentUserName =
    [currentUser.firstname, currentUser.lastname].filter(Boolean).join(' ') ||
    currentUser.username ||
    'Dorfdüse';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <DashboardView
        user={{
          id: targetUser.id,
          firstname: targetUser.firstname,
          lastname: targetUser.lastname,
          username: targetUser.username,
          profile: targetUser.profile,
          city: targetUser.city,
          country: targetUser.country,
          stravaAthleteId: targetUser.stravaAthleteId,
        }}
        currentUser={{
          id: currentUser.id,
          name: currentUserName,
          profile: currentUser.profile,
        }}
        allMembers={allMembers}
        isReadOnly={isReadOnly}
        activities={activities}
        stats={stats}
        pagination={pagination}
        initialNotifications={notifications}
      />
      <NotificationToast />
    </div>
  );
}
