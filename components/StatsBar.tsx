import { Users, Route, Clock } from 'lucide-react';
import { InstagramIcon } from '@/components/icons/BrandIcons';
import { ClubData } from '@/types/club';

interface StatsBarProps {
  club: ClubData;
}

export function StatsBar({ club }: StatsBarProps) {
  const stats = [
    {
      label: 'Strava Clubmitglieder',
      value: `${club.stats.stravaMembers}+`,
      subtext: 'Aktive Sportler im Ried',
      icon: Users,
    },
    {
      label: 'Sonntagsrunde Distanz',
      value: '5 km',
      subtext: 'Flach & für alle machbar',
      icon: Route,
    },
    {
      label: 'Mindest-Pace',
      value: '0 min/km',
      subtext: 'Kein Druck, 100% Team',
      icon: Clock,
    },
    {
      label: 'Instagram Community',
      value: `${club.stats.instagramFollowers}+`,
      subtext: 'Follower auf @dorfduesen',
      icon: InstagramIcon,
    },
  ];

  return (
    <section className="border-y border-zinc-800/80 bg-zinc-950/60 py-10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className="flex flex-col items-center sm:items-start p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/50 hover:border-zinc-700/80 transition-colors"
              >
                <div className="p-2.5 rounded-lg bg-orange-600/10 text-orange-500 mb-3 border border-orange-500/20">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {stat.value}
                </div>
                <div className="text-sm font-bold text-zinc-200 mt-1">
                  {stat.label}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {stat.subtext}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
