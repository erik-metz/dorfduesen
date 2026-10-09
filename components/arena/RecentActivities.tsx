import Image from 'next/image';
import Link from 'next/link';
import { Activity, ExternalLink } from 'lucide-react';
import type { RecentArenaActivity } from '@/lib/arena/recent-activities';
import { isValidAvatarUrl } from '@/lib/utils/avatar';

export function RecentActivities({ activities }: { activities: RecentArenaActivity[] }) {
  return (
    <section aria-labelledby="recent-activities-title" className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-600/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider mb-2">
          <Activity className="w-3.5 h-3.5" aria-hidden="true" /> Community Feed
        </div>
        <h2 id="recent-activities-title" className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase">Neueste Aktivitäten</h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">Die letzten 20 Aktivitäten aller Mitglieder – gemeinsam unterwegs.</p>
      </div>
      {activities.length === 0 ? (
        <div className="rounded-3xl bg-zinc-900/60 border border-zinc-800 p-12 text-center space-y-4">
          <Activity className="w-12 h-12 text-zinc-600 mx-auto" aria-hidden="true" />
          <div className="text-lg font-bold text-white">Noch keine Aktivitäten</div>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">Hier erscheinen die neuesten Aktivitäten, sobald ein Mitglied seine Strava-Aktivitäten synchronisiert hat.</p>
        </div>
      ) : (
        <div className="rounded-3xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" aria-labelledby="recent-activities-title">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] font-black uppercase tracking-wider text-zinc-400 bg-zinc-950/40">
                  <th scope="col" className="py-4 px-4">Athlet</th>
                  <th scope="col" className="py-4 px-4 hidden md:table-cell">Aktivität</th>
                  <th scope="col" className="py-4 px-4">Distanz</th>
                  <th scope="col" className="py-4 px-4 hidden sm:table-cell">Zeit</th>
                  <th scope="col" className="py-4 px-4 hidden lg:table-cell">Datum</th>
                  <th scope="col" className="py-4 px-4 text-right pr-6">Strava</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {activities.map(activity => {
                  const minutes = Math.floor(activity.movingTime / 60);
                  const duration = minutes >= 60 ? `${Math.floor(minutes / 60)} Std ${minutes % 60} Min` : `${minutes} Min`;
                  const sport = activity.sportType.toLowerCase().includes('run') ? 'Laufen' : activity.sportType.toLowerCase().includes('ride') ? 'Radfahren' : activity.sportType;
                  const date = new Date(activity.startDate).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  return (
                    <tr key={activity.id} className="hover:bg-zinc-800/40 transition-colors group">
                      <td className="py-4 px-4">
                        <Link href={`/dashboard?userId=${activity.userId}`} className="flex items-center gap-3 group/link hover:opacity-90 transition-opacity rounded-lg focus-visible:outline-2 focus-visible:outline-orange-400" title={`${activity.userName} im Dashboard ansehen`}>
                          <div className="relative w-9 h-9 rounded-full overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700">
                            {isValidAvatarUrl(activity.userProfile) ? (
                              <Image src={activity.userProfile!} alt="" fill sizes="36px" unoptimized className="object-cover" />
                            ) : <span className="w-full h-full flex items-center justify-center text-xs font-bold text-orange-400">{activity.userName.charAt(0)}</span>}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white group-hover/link:text-orange-400 transition-colors">{activity.userName}</div>
                            <div className="text-[11px] text-zinc-500">{sport}</div>
                            <div className="text-[11px] text-zinc-400 md:hidden">{activity.name}</div>
                            <time dateTime={activity.startDate} className="block text-[11px] text-zinc-500 lg:hidden">{date}</time>
                          </div>
                        </Link>
                      </td>
                      <td className="py-4 px-4 text-zinc-300 hidden md:table-cell">{activity.name}</td>
                      <td className="py-4 px-4 font-black text-white text-base whitespace-nowrap">
                        {activity.distanceKm.toFixed(1)}{' '}<span className="text-xs text-orange-400 font-bold">km</span>
                        <div className="text-[11px] font-normal text-zinc-400 sm:hidden">{duration}</div>
                      </td>
                      <td className="py-4 px-4 text-zinc-300 hidden sm:table-cell whitespace-nowrap">{duration}</td>
                      <td className="py-4 px-4 text-zinc-400 hidden lg:table-cell whitespace-nowrap"><time dateTime={activity.startDate}>{date}</time></td>
                      <td className="py-4 px-4 text-right pr-6">
                        <a href={`https://www.strava.com/activities/${activity.stravaId}`} target="_blank" rel="noopener noreferrer" aria-label={`${activity.name} auf Strava ansehen`} className="inline-flex p-2 rounded-lg text-zinc-400 hover:text-orange-400 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-orange-400">
                          <ExternalLink className="w-4 h-4" aria-hidden="true" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
