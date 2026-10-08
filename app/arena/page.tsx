import React, { Suspense } from 'react';
import { connection } from 'next/server';
import { getClubData } from '@/lib/data/club';
import { getArenaData } from '@/lib/arena/stats';
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

function ArenaSkeleton() {
  return (
    <div className="py-24 text-center text-zinc-500">
      <div className="animate-pulse">Lade Düsen-Arena...</div>
    </div>
  );
}

export default async function ArenaPage() {
  const club = await getClubData();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-orange-600 selection:text-white">
      {/* Sticky Navbar */}
      <Navbar club={club} />

      {/* Main Arena Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-16">
        <Suspense fallback={<ArenaSkeleton />}>
          <ArenaContent />
        </Suspense>
      </main>

      {/* Toast notifications */}
      <NotificationToast />

      {/* Footer */}
      <Footer club={club} />
    </div>
  );
}

async function ArenaContent() {
  await connection();
  const arenaData = await getArenaData('week', 'all');

  return (
    <>
      {/* Hero with weekly KPIs */}
      <ArenaHero
        weekKm={arenaData.weekKm}
        weekHours={arenaData.weekHours}
        weekActivitiesCount={arenaData.weekActivitiesCount}
        activeAthletesCount={arenaData.activeAthletesCount}
      />

      {/* Monthly Team Challenge Progress */}
      <TeamChallengeBar challenge={arenaData.challenge} />

      {/* 6 Weekly Champions Titles */}
      <WeeklyChampions champions={arenaData.champions} />

      {/* Multi-Leaderboard Table */}
      <MultiLeaderboard initialEntries={arenaData.leaderboard} />

      {/* Badges & Milestones Showcase */}
      <BadgesShowcase badges={arenaData.availableBadges} />
    </>
  );
}
