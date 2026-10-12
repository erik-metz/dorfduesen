import { berlinMidnight, shiftDay, weekRange } from '@/lib/time';
import type { ChampionTitle } from './stats';

type Activity = { userId: string; startDate: Date; startDateLocal: Date; movingTime: number; sportType: string; distance: number };
type User = { id: string; firstname: string | null; createdAt: Date };
type Goal = { userId: string; activeDays: number; createdAt: Date; updatedAt: Date };
export type WeeklyRecap = {
  userId: string; title: string; message: string;
  metadata: {
    weekKey: string; outcome: 'celebration' | 'motivation'; icon: string; activeDays: number;
    awards: { title: string; icon: string; formattedValue: string }[];
    targetTitle?: string; missing?: number; unit?: 'Tage' | 'km';
  };
};

/** Celebrate the persisted awards, even if activities were edited after an earlier close. */
export function snapshotWeeklyChampions(champions: ChampionTitle[], holders: { titleId: string; userId: string; value: number }[]): ChampionTitle[] {
  return champions.map(champ => ({ ...champ, winner: null, recipients: holders
    .filter(h => h.titleId.split(':')[0] === champ.id && h.value > 0)
    .map(h => {
      const original = (champ.recipients ?? (champ.winner ? [champ.winner] : [])).find(w => w.userId === h.userId && Math.abs(w.value - h.value) < 0.000001);
      const fallback: Record<string, string> = {
        run_distance: `${h.value.toFixed(1)} km`, ride_distance: `${h.value.toFixed(1)} km`,
        stayed_active: `${h.value} Tage aktiv`, routine: '3 Wochen regelmäßig am Start',
        goal: 'Eigenes Wochenziel geschafft', progress: `${h.value} aktive Tage`,
        distance: `${h.value.toFixed(1)} km`, elevation: `${Math.round(h.value)} m`,
        time: `${h.value.toFixed(1)} Std`, heartrate: `${Math.round(h.value)} bpm`,
        early_bird: `${h.value.toFixed(1)} km`, consistency: `${h.value} Tage aktiv`,
      };
      return { userId: h.userId, name: '', profile: null, value: h.value,
        formattedValue: original?.formattedValue ?? fallback[champ.id] ?? String(h.value) };
    }),
  }));
}

/** A frozen, personal summary of the completed week, including honest next steps. */
export function buildWeeklyRecaps(weekKey: string, users: User[], activities: Activity[], goals: Goal[], champions: ChampionTitle[]): WeeklyRecap[] {
  const start = berlinMidnight(weekKey);
  const end = berlinMidnight(shiftDay(weekKey, 7));
  const historyStart = berlinMidnight(shiftDay(weekKey, -28));
  return users.filter(user => user.createdAt < end).map(user => {
    const own = activities.filter(a => a.userId === user.id && a.movingTime > 0 && a.startDate >= historyStart && a.startDate < end);
    const current = own.filter(a => a.startDate >= start);
    const days = new Set(current.map(a => a.startDateLocal.toISOString().slice(0, 10))).size;
    const awards = champions.flatMap(champion => {
      const winner = (champion.recipients ?? (champion.winner ? [champion.winner] : [])).find(w => w.userId === user.id && w.value > 0);
      return winner ? [{ title: champion.title, icon: champion.icon, formattedValue: winner.formattedValue }] : [];
    });
    const greeting = user.firstname ? `${user.firstname}, ` : '';
    if (awards.length) return {
      userId: user.id, title: `${greeting}das ist deine Woche!`,
      message: `Du hast ${awards.length === 1 ? 'einen Wochenerfolg' : `${awards.length} Wochenerfolge`} geschafft. ${awards.map(a => `${a.title} – ${a.formattedValue}`).join(' · ')}. Feier dich!`,
      metadata: { weekKey, outcome: 'celebration', icon: '🏆', activeDays: days, awards },
    };

    const targets: { title: string; missing: number; unit: 'Tage' | 'km'; ratio: number }[] = [];
    const dayTarget = (title: string, target: number) => {
      if (days < target && target <= 7) targets.push({ title, missing: target - days, unit: 'Tage', ratio: days / target });
    };
    const goal = goals.find(g => g.userId === user.id && g.createdAt < start && g.updatedAt < start);
    if (goal) dayTarget('Vorgenommen. Durchgezogen.', goal.activeDays);
    const previousDays = [-7, -14, -21, -28].map(offset => {
      const key = shiftDay(weekKey, offset);
      return new Set(own.filter(a => weekRange(a.startDate).key === key).map(a => a.startDateLocal.toISOString().slice(0, 10))).size;
    });
    if (previousDays[0] >= 2 && previousDays[1] >= 2) dayTarget('Dauer-Düse.', 2);
    if (user.createdAt <= historyStart) dayTarget('Eine Schippe drauf.', Math.floor(previousDays.reduce((sum, n) => sum + n, 0) / 4) + 1);
    dayTarget('Sofa hat verloren.', 2);
    for (const [id, sports] of [
      ['run_distance', ['Run', 'TrailRun', 'VirtualRun']],
      ['ride_distance', ['Ride', 'MountainBikeRide', 'GravelRide', 'VirtualRide', 'Handcycle', 'Velomobile']],
    ] as const) {
      const champion = champions.find(c => c.id === id);
      const ownKm = current.filter(a => (sports as readonly string[]).includes(a.sportType)).reduce((sum, a) => sum + Math.max(0, a.distance) / 1000, 0);
      const best = champion?.winner?.value ?? champion?.recipients?.[0]?.value ?? 0;
      // Only suggest a competitive result when the athlete was actually close in their sport.
      if (champion && ownKm > 0 && best > ownKm && ownKm / best >= 0.8) {
        targets.push({ title: champion.title, missing: Math.ceil((best - ownKm) * 10) / 10, unit: 'km', ratio: ownKm / best });
      }
    }
    targets.sort((a, b) => b.ratio - a.ratio);
    const nearest = targets[0];
    if (days && !nearest) return {
      userId: user.id, title: `${greeting}bleib dran!`,
      message: `Du warst an ${days} ${days === 1 ? 'Tag' : 'Tagen'} aktiv. Diese Woche war kein Wochentitel dabei. Deine Bewegung zählt trotzdem – nächste Woche beginnt eine neue Runde!`,
      metadata: { weekKey, outcome: 'motivation', icon: '🚀', activeDays: days, awards },
    };
    const amount = nearest.missing.toLocaleString('de-DE', { maximumFractionDigits: 1 });
    const gap = nearest.unit === 'km' ? `${amount} km zum geteilten Wochensieg` : `${amount} weitere${nearest.missing === 1 ? 'r aktiver Tag' : ' aktive Tage'}`;
    return {
      userId: user.id, title: days ? `${greeting}dein nächster Erfolg wartet!` : `${greeting}neue Woche, neue Chance!`,
      message: days
        ? `Du warst an ${days} ${days === 1 ? 'Tag' : 'Tagen'} aktiv. Für „${nearest.title}“ ${nearest.missing === 1 && nearest.unit === 'Tage' ? 'hätte' : 'hätten'} ${gap} gereicht. Nimm den Schwung mit in die neue Woche!`
        : 'Diese Woche ist keine Aktivität gespeichert. Zwei aktive Tage in einer Woche bringen dir „Sofa hat verloren.“. Fang mit einer Runde an – jede Bewegung zählt!',
      metadata: { weekKey, outcome: 'motivation', icon: days ? '🚀' : '🌱', activeDays: days, awards,
        targetTitle: days ? nearest.title : 'Sofa hat verloren.', missing: days ? nearest.missing : 2, unit: days ? nearest.unit : 'Tage' },
    };
  });
}
