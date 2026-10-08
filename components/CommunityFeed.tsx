import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Trophy, Footprints, Flame, ExternalLink, Users } from 'lucide-react';
import { db } from '@/lib/db';
import { StravaIcon } from '@/components/icons/BrandIcons';

export async function CommunityFeed() {
  // Fetch top runners and recent activities from database
  let topAthletes: {
    userId: string;
    name: string;
    profile: string | null;
    totalKm: number;
    activityCount: number;
  }[] = [];

  let recentActivities: {
    id: string;
    stravaId: string;
    name: string;
    distance: number;
    sportType: string;
    startDate: string;
    userName: string;
    userProfile: string | null;
  }[] = [];

  let totalCommunityDistanceKm = 0;

  try {
    const rawActivities = await db.activity.findMany({
      include: {
        user: {
          select: {
            firstname: true,
            lastname: true,
            username: true,
            profile: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
      take: 8,
    });

    recentActivities = rawActivities.map((act) => ({
      id: act.id,
      stravaId: act.stravaId,
      name: act.name,
      distance: act.distance,
      sportType: act.sportType,
      startDate: act.startDate.toISOString(),
      userName: [act.user.firstname, act.user.lastname].filter(Boolean).join(' ') || act.user.username || 'Dorfdüse',
      userProfile: act.user.profile,
    }));

    // Aggregate by user
    const userMap: Record<string, { name: string; profile: string | null; totalKm: number; activityCount: number }> = {};
    const allDbActivities = await db.activity.findMany({
      include: {
        user: {
          select: {
            firstname: true,
            lastname: true,
            username: true,
            profile: true,
          },
        },
      },
    });

    for (const a of allDbActivities) {
      const uName = [a.user.firstname, a.user.lastname].filter(Boolean).join(' ') || a.user.username || 'Dorfdüse';
      if (!userMap[a.userId]) {
        userMap[a.userId] = {
          name: uName,
          profile: a.user.profile,
          totalKm: 0,
          activityCount: 0,
        };
      }
      userMap[a.userId].totalKm += a.distance / 1000;
      userMap[a.userId].activityCount += 1;
      totalCommunityDistanceKm += a.distance / 1000;
    }

    topAthletes = Object.entries(userMap)
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.totalKm - a.totalKm)
      .slice(0, 3);
  } catch (error) {
    console.error('Error loading community activities:', error);
  }

  // If no DB activities yet, show the pre-launch / invitation teaser
  const hasDbActivities = recentActivities.length > 0;

  return (
    <section className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-600/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5" /> Live Community Stats
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
              Das Dorfdüsen Leaderboard
            </h2>
            <p className="text-base sm:text-lg text-zinc-300">
              Wer hat wie viele Kilometer gesammelt? Verbinde deinen Strava-Account, und deine Läufe erscheinen automatisch in unserer Club-Rangliste!
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
            <Link
              href="/arena"
              className="inline-flex items-center gap-1.5 px-5 py-3.5 rounded-xl font-bold bg-zinc-900 hover:bg-zinc-800 text-orange-400 border border-zinc-700/80 transition-all text-sm"
            >
              <span>Düsen-Arena</span>
              <span>🏆</span>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold bg-[#fc5200] hover:bg-[#e04800] text-white shadow-xl shadow-[#fc5200]/25 transition-all text-sm"
            >
              <StravaIcon className="w-4 h-4" />
              <span>Mitdüsen</span>
            </Link>
          </div>
        </div>

        {hasDbActivities ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Top 3 Podium Cards */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-6 space-y-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <span className="font-bold text-white uppercase text-xs tracking-wider">
                      Top Kilometer-Sammler
                    </span>
                  </div>
                  <span className="text-xs text-orange-400 font-bold">
                    {totalCommunityDistanceKm.toFixed(1)} km Gesamt
                  </span>
                </div>

                <div className="space-y-3">
                  {topAthletes.map((ath, idx) => (
                    <div
                      key={ath.userId}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                            idx === 0
                              ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40'
                              : idx === 1
                              ? 'bg-zinc-400/20 text-zinc-300 border border-zinc-400/40'
                              : 'bg-amber-700/20 text-amber-600 border border-amber-700/40'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div className="relative w-9 h-9 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                          {ath.profile ? (
                            <Image src={ath.profile} alt={ath.name} fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs font-bold">
                              {ath.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white leading-tight">{ath.name}</div>
                          <div className="text-[11px] text-zinc-500">{ath.activityCount} Aktivitäten</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-black text-white">{ath.totalKm.toFixed(1)} km</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Live Activities Stream */}
            <div className="lg:col-span-7 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                <Footprints className="w-4 h-4 text-orange-500" /> Letzte Aktivitäten der Truppe
              </h3>

              <div className="space-y-2.5">
                {recentActivities.map((act) => (
                  <div
                    key={act.id}
                    className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                        {act.userProfile ? (
                          <Image src={act.userProfile} alt={act.userName} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-400">
                            {act.userName.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-orange-400">{act.userName}</div>
                        <div className="text-sm font-bold text-white line-clamp-1">{act.name}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-black text-white">{(act.distance / 1000).toFixed(2)} km</div>
                        <div className="text-[10px] text-zinc-500">
                          {new Date(act.startDate).toLocaleDateString('de-DE')}
                        </div>
                      </div>
                      <a
                        href={`https://www.strava.com/activities/${act.stravaId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
                        title="Auf Strava ansehen"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Empty state / Invitation banner */
          <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-8 sm:p-12 text-center space-y-6 shadow-xl relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-orange-600/15 border border-orange-500/30 text-orange-500 mx-auto flex items-center justify-center text-3xl shadow-lg">
              <Flame className="w-8 h-8 fill-orange-500 text-orange-500" />
            </div>

            <div className="max-w-xl mx-auto space-y-2">
              <h3 className="text-2xl font-black text-white">Sei der Erste im Dorfdüsen Leaderboard!</h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Sobald du deinen Strava-Account verknüpfst, fließen deine gelaufenen und geradelten Kilometer 
                automatisch in unsere Community-Statistik ein.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link
                href="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold bg-[#fc5200] hover:bg-[#e04800] text-white shadow-xl shadow-[#fc5200]/25 transition-all text-sm"
              >
                <StravaIcon className="w-4 h-4" />
                <span>Mit Strava anmelden & starten</span>
              </Link>
            </div>

            <div className="pt-4 flex items-center justify-center gap-2 text-xs text-zinc-500">
              <Users className="w-4 h-4 text-zinc-400" />
              <span>18 Mitglieder im Strava Club Nordheim • 100% kostenlos</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
