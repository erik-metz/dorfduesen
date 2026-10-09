import type { ChampionTitle } from './stats';

export type PersonalWeek = {
  userId: string;
  values: Record<string, number>;
  achievements: string[];
  activeDays: number;
  previousDays: number[];
  historyAvailable: boolean;
  averageDays: number;
  nextWeek: string;
  nextGoal: number | null;
  currentGoal: number | null;
};

/** Keep real performance winners; spread personal spotlights across more members. */
export function highlightCards(champions: ChampionTitle[]) {
  const shown = new Set<string>();
  const cards = champions.map(champion => {
    const recipients = champion.recipients ?? (champion.winner ? [champion.winner] : []);
    const featured = champion.kind === 'recognition'
      ? recipients.find(r => !shown.has(r.userId)) ?? recipients[0]
      : recipients[0];
    if (featured) shown.add(featured.userId);
    return { champion, recipients, featured };
  });
  return cards.sort((a, b) => {
    const order = ['run_distance', 'ride_distance', 'stayed_active', 'routine', 'progress', 'goal'];
    return order.indexOf(a.champion.id) - order.indexOf(b.champion.id);
  });
}

export function highlightHint(champion: ChampionTitle, personal: PersonalWeek): string {
  const achieved = champion.recipients?.some(r => r.userId === personal.userId) || champion.winner?.userId === personal.userId || personal.achievements.includes(champion.title);
  if (achieved) return champion.id === 'stayed_active' ? 'Sofa besiegt. Du bist dabei. ✓' : 'Auch du hast das geschafft. ✓';
  const remaining = (target: number) => Math.max(0, target - personal.activeDays);
  switch (champion.id) {
    case 'stayed_active':
      return remaining(2) === 1 ? 'Noch einmal raus. Dann verliert das Sofa.' : 'Zweimal raus. Sofa besiegt.';
    case 'routine':
      return personal.previousDays.every(n => n >= 2)
        ? `Noch ${remaining(2)} ${remaining(2) === 1 ? 'Tag' : 'Tage'} aktiv. Dann bist du Dauer-Düse.`
        : 'Jede Woche zweimal raus. Deine Serie läuft an.';
    case 'progress':
      return personal.historyAvailable
        ? `Noch ${remaining(Math.floor(personal.averageDays) + 1)} ${remaining(Math.floor(personal.averageDays) + 1) === 1 ? 'aktiver Tag' : 'aktive Tage'} für deine nächste Schippe.`
        : 'Erst ankommen. Dann eine Schippe drauf.';
    case 'goal':
      return personal.currentGoal
        ? `Noch ${remaining(personal.currentGoal)} ${remaining(personal.currentGoal) === 1 ? 'Tag' : 'Tage'} bis zu deinem Ziel.`
        : 'Dein nächstes Ziel? Leg’s im Dashboard fest.';
    case 'run_distance':
    case 'ride_distance': {
      const gap = Math.max(0, (champion.winner?.value ?? 0) - (personal.values[champion.id] ?? 0));
      const needed = ((Math.floor(gap * 10 + 1e-9) + 1) / 10).toLocaleString('de-DE', { maximumFractionDigits: 1 });
      return `Noch ${needed} km bis zur Krone.`;
    }
    default: return 'Rausgehen. Mitdüsen.';
  }
}
