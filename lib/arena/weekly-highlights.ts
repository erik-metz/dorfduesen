import type { ChampionTitle } from './stats';
import { berlinMidnight, shiftDay, weekRange } from '@/lib/time';

// Completed weeks retain their original rules and trophies.
export const HIGHLIGHTS_START_WEEK = '2026-10-12';
type Athlete = { id: string; firstname: string | null; lastname: string | null; username: string | null; profile: string | null };
type Activity = { startDate: Date; startDateLocal: Date; sportType: string; distance: number; movingTime: number; user: Athlete };

export function computeHighlights(
  activities: Activity[], weekKey: string,
  goals: { userId: string; activeDays: number; createdAt: Date; updatedAt: Date }[],
  users: { id: string; createdAt: Date }[], pastHonors: Record<string, number> = {},
): ChampionTitle[] {
  const start = berlinMidnight(weekKey);
  const end = berlinMidnight(shiftDay(weekKey, 7));
  const historyStart = berlinMidnight(shiftDay(weekKey, -28));
  const joined = new Map(users.map(u => [u.id, u.createdAt]));
  const metrics = new Map<string, { user: Athlete; run: number; ride: number; days: Set<string>; history: Map<string, Set<string>> }>();
  for (const a of activities) {
    // Empty recordings don't count; splitting a workout never creates extra days.
    if (a.movingTime <= 0 || a.startDate < historyStart || a.startDate >= end) continue;
    let m = metrics.get(a.user.id);
    if (!m) { m = { user: a.user, run: 0, ride: 0, days: new Set(), history: new Map() }; metrics.set(a.user.id, m); }
    const localDay = a.startDateLocal.toISOString().slice(0, 10);
    if (a.startDate >= start) {
      m.days.add(localDay);
      if (['Run', 'TrailRun', 'VirtualRun'].includes(a.sportType)) m.run += Math.max(0, a.distance) / 1000;
      if (['Ride', 'MountainBikeRide', 'GravelRide', 'VirtualRide', 'Handcycle', 'Velomobile'].includes(a.sportType)) m.ride += Math.max(0, a.distance) / 1000;
    } else {
      const key = weekRange(a.startDate).key;
      const days = m.history.get(key) ?? new Set<string>();
      days.add(localDay); m.history.set(key, days);
    }
  }
  const rows = [...metrics.values()].filter(m => m.days.size > 0);
  const recipient = (m: typeof rows[number], value: number, formattedValue: string) => ({
    userId: m.user.id, name: [m.user.firstname, m.user.lastname].filter(Boolean).join(' ') || m.user.username || 'Athlet',
    profile: m.user.profile, value, formattedValue,
  });
  const performance = (id: 'run_distance' | 'ride_distance', title: string, icon: string, key: 'run' | 'ride'): ChampionTitle => {
    const sorted = [...rows].filter(m => m[key] > 0).sort((a, b) => b[key] - a[key] || a.user.id.localeCompare(b.user.id));
    const best = sorted[0];
    // Exact ties share the title rather than depending on database ordering.
    const winners = best ? sorted.filter(m => m[key] === best[key]).map(m => recipient(m, m[key], `${m[key].toFixed(1)} km`)) : [];
    return { id, title, icon, subtitle: key === 'run' ? 'Laufkilometer dieser Woche · gemeinsame Siege bei Gleichstand' : 'Radkilometer dieser Woche · ohne E-Bike', winner: winners[0] ?? null, recipients: winners };
  };
  const recognition = (id: string, title: string, icon: string, subtitle: string, qualify: (m: typeof rows[number]) => boolean, format = (m: typeof rows[number]) => `${m.days.size} aktive Tage`): ChampionTitle => ({
    id, title, icon, subtitle, kind: 'recognition', winner: null,
    recipients: rows.filter(qualify).sort((a, b) => (pastHonors[a.user.id] ?? 0) - (pastHonors[b.user.id] ?? 0) || a.user.id.localeCompare(b.user.id))
      .map(m => recipient(m, m.days.size, format(m))),
  });
  const average = (m: typeof rows[number]) => [...m.history.values()].reduce((sum, days) => sum + days.size, 0) / 4;
  return [
    performance('run_distance', 'Laufleistung der Woche', '🏃', 'run'),
    performance('ride_distance', 'Radleistung der Woche', '🚲', 'ride'),
    recognition('stayed_active', 'Drangeblieben', '🌱', 'Mindestens zwei verschiedene aktive Tage – für alle erreichbar', m => m.days.size >= 2),
    recognition('routine', 'Gute Routine', '📅', 'Drei Wochen in Folge jeweils mindestens zwei aktive Tage', m => m.days.size >= 2 && [-7, -14].every(offset => (m.history.get(shiftDay(weekKey, offset))?.size ?? 0) >= 2)),
    recognition('goal', 'Wochenziel geschafft', '🎯', 'Das vor Wochenbeginn selbst gewählte Tagesziel erreicht', m => {
      const goal = goals.find(g => g.userId === m.user.id);
      return Boolean(goal && goal.createdAt < start && goal.updatedAt < start && m.days.size >= goal.activeDays);
    }),
    recognition('progress', 'Persönlicher Fortschritt', '✨', 'Mehr aktive Tage als im eigenen Vier-Wochen-Durchschnitt', m =>
      (joined.get(m.user.id)?.getTime() ?? Infinity) <= historyStart.getTime() && m.days.size > average(m),
      m => `${m.days.size} Tage · zuvor Ø ${average(m).toLocaleString('de-DE', { maximumFractionDigits: 1 })}`),
  ];
}
