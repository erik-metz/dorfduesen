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
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activities.map(activity => {
            const minutes = Math.floor(activity.movingTime / 60);
            const duration = minutes >= 60 ? `${Math.floor(minutes / 60)} Std ${minutes % 60} Min` : `${minutes} Min`;
            const sport = activity.sportType.toLowerCase().includes('run') ? 'Laufen' : activity.sportType.toLowerCase().includes('ride') ? 'Radfahren' : activity.sportType;
            return (
              <li key={activity.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/dashboard?userId=${activity.userId}`} className="flex items-center gap-3 min-w-0 hover:text-orange-400 text-white">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                      {isValidAvatarUrl(activity.userProfile) ? (
                        <Image src={activity.userProfile!} alt="" fill sizes="40px" unoptimized className="object-cover" />
                      ) : <span className="flex h-full items-center justify-center font-bold text-orange-400">{activity.userName.charAt(0)}</span>}
                    </div>
                    <span className="font-bold truncate">{activity.userName}</span>
                  </Link>
                  <a href={`https://www.strava.com/activities/${activity.stravaId}`} target="_blank" rel="noopener noreferrer" aria-label={`${activity.name} auf Strava ansehen`} className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white shrink-0">
                    <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  </a>
                </div>
                <div>
                  <Link href={`/dashboard?userId=${activity.userId}`} className="block font-bold text-white hover:text-orange-400 break-words">{activity.name}</Link>
                  <div className="text-xs text-zinc-400 mt-1">
                    {sport} · <time dateTime={activity.startDate}>{new Date(activity.startDate).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
                  </div>
                </div>
                <div className="flex gap-5 text-sm font-bold text-orange-400">
                  <span>{activity.distanceKm.toLocaleString('de-DE', { maximumFractionDigits: 2 })} km</span>
                  <span className="text-zinc-300">{duration}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
