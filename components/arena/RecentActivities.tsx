import Image from 'next/image';
import Link from 'next/link';
import { Activity, ExternalLink } from 'lucide-react';
import type { RecentArenaActivity } from '@/lib/arena/recent-activities';
import { isValidAvatarUrl } from '@/lib/utils/avatar';

export function RecentActivities({ activities }: { activities: RecentArenaActivity[] }) {
  return (
    <section aria-labelledby="recent-activities-title" className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-orange-400 mb-2">
          <Activity className="w-5 h-5" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider">Community Feed</span>
        </div>
        <h2 id="recent-activities-title" className="text-2xl sm:text-4xl font-black text-white uppercase">Neueste Aktivitäten</h2>
        <p className="text-sm text-zinc-400 mt-2">Die letzten 20 Aktivitäten aller Mitglieder – gemeinsam unterwegs.</p>
      </div>
      {activities.length === 0 ? (
        <p className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-zinc-400">Hier erscheinen die neuesten Aktivitäten, sobald ein Mitglied seine Strava-Aktivitäten synchronisiert hat.</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 divide-y divide-zinc-800">
          {activities.map(activity => {
            const minutes = Math.floor(activity.movingTime / 60);
            const duration = minutes >= 60 ? `${Math.floor(minutes / 60)} Std ${minutes % 60} Min` : `${minutes} Min`;
            const sport = activity.sportType.toLowerCase().includes('run') ? 'Laufen' : activity.sportType.toLowerCase().includes('ride') ? 'Radfahren' : activity.sportType;
            return (
              <li key={activity.id} className="flex items-center gap-3 px-4 py-3 sm:gap-5 sm:px-5 hover:bg-zinc-800/40 transition-colors">
                <Link href={`/dashboard?userId=${activity.userId}`} className="group flex flex-1 items-center gap-3 min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-orange-400">
                  <div className="relative w-9 h-9 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                    {isValidAvatarUrl(activity.userProfile) ? (
                      <Image src={activity.userProfile!} alt="" fill sizes="36px" unoptimized className="object-cover" />
                    ) : <span className="flex h-full items-center justify-center font-bold text-orange-400">{activity.userName.charAt(0)}</span>}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-orange-400 truncate">{activity.userName}</div>
                    <div className="text-sm font-bold text-white group-hover:text-orange-400 truncate">{activity.name}</div>
                    <div className="flex flex-wrap gap-x-2 text-xs text-zinc-400 mt-0.5">
                      <span>{sport}</span>
                      <time dateTime={activity.startDate}>{new Date(activity.startDate).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
                    </div>
                  </div>
                </Link>
                <div className="shrink-0 text-right tabular-nums">
                  <div className="text-sm font-bold text-orange-400">{activity.distanceKm.toLocaleString('de-DE', { maximumFractionDigits: 2 })} km</div>
                  <div className="text-xs text-zinc-400 mt-0.5">{duration}</div>
                </div>
                <a href={`https://www.strava.com/activities/${activity.stravaId}`} target="_blank" rel="noopener noreferrer" aria-label={`${activity.name} auf Strava ansehen`} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0 focus-visible:outline-2 focus-visible:outline-orange-400">
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
