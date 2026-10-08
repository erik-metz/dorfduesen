import React from 'react';
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
import { cacheLife, cacheTag } from 'next/cache';

export const metadata = {
  title: 'Düsen-Arena | Dorfdüsen Nordheim Leaderboard & Titel',
  description:
    'Die gamifizierte Club-Arena der Dorfdüsen Nordheim: Wöchentliche Titel, Gruppenstatistiken, Badges und das Multi-Leaderboard.',
};

export default async function ArenaPage() {
  'use cache';
  cacheLife({
    stale: 30,
    revalidate: 15,
    expire: 300,
  });
  cacheTag('arena');

  const [club, arenaData] = await Promise.all([
    getClubData(),
    getArenaData('week', 'all'),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-orange-600 selection:text-white">
      {/* Sticky Navbar */}
      <Navbar club={club} />

      {/* Main Arena Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-16">
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
      </main>

      {/* Toast notifications */}
      <NotificationToast />

      {/* Footer */}
      <Footer club={club} />
    </div>
  );
}
