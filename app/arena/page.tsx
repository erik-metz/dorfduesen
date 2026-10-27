import React from 'react';
import { connection } from 'next/server';
import { getClubData } from '@/lib/data/club';
import { getArenaData } from '@/lib/arena/stats';
import { getRecentArenaActivities } from '@/lib/arena/recent-activities';
import { RecentActivities } from '@/components/arena/RecentActivities';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ArenaHero } from '@/components/arena/ArenaHero';
import { TeamChallengeBar } from '@/components/arena/TeamChallengeBar';
import { WeeklyChampions } from '@/components/arena/WeeklyChampions';
import { MultiLeaderboard } from '@/components/arena/MultiLeaderboard';
import { BadgesShowcase } from '@/components/arena/BadgesShowcase';
import { NotificationToast } from '@/components/NotificationToast';

export const metadata = {
  title: 'Düsen-Arena | Dorfdüsen Nordheim Leaderboard & Titel',
  description:
    'Die gamifizierte Club-Arena der Dorfdüsen Nordheim: Wöchentliche Titel, Gruppenstatistiken, Badges und das Multi-Leaderboard.',
};

export default async function ArenaPage() {
  const club = await getClubData();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-orange-600 selection:text-white">
      {/* Sticky Navbar */}
      <Navbar club={club} />

      {/* Main Arena Content */}
      <main className="w-full min-w-0 flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-16">
        <React.Suspense fallback={<ArenaLoading />}>
          <ArenaLiveData />
        </React.Suspense>
      </main>

      {/* Toast notifications */}
      <NotificationToast />

      {/* Footer */}
      <Footer club={club} />
    </div>
  );
}

async function ArenaLiveData() {
  // The database-backed views are cached at request time, but must not be computed
  // while the production build is prerendering this route.
  await connection();
  const [arenaData, recentActivities] = await Promise.all([
    getArenaData('week', 'all'),
    getRecentArenaActivities(),
  ]);

  return (
    <>
      <ArenaHero
        weekKm={arenaData.weekKm}
        weekHours={arenaData.weekHours}
        weekActivitiesCount={arenaData.weekActivitiesCount}
        activeAthletesCount={arenaData.activeAthletesCount}
      />
      <TeamChallengeBar challenge={arenaData.challenge} />
      <WeeklyChampions champions={arenaData.champions} />
      <MultiLeaderboard initialEntries={arenaData.leaderboard} />
      <RecentActivities activities={recentActivities} />
      <BadgesShowcase badges={arenaData.availableBadges} />
    </>
  );
}

function ArenaLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Arena wird geladen">
      <div className="h-48 animate-pulse rounded-3xl bg-zinc-900" />
      <div className="h-32 animate-pulse rounded-3xl bg-zinc-900" />
      <div className="h-96 animate-pulse rounded-3xl bg-zinc-900" />
    </div>
  );
}
