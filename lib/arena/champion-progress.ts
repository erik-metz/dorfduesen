import type { ChampionTitle } from './stats';

const number = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 1 });

export function championProgress(champion: ChampionTitle, ownValue: number, userId: string): string {
  if (champion.winner?.userId === userId || champion.recipients?.some(r => r.userId === userId)) return 'Du führst diese Woche – verteidige deine Krone!';
  const leader = champion.winner?.value ?? 0;
  const gap = Math.max(0, leader - ownValue);
  switch (champion.id) {
    case 'run_distance':
    case 'ride_distance':
    case 'distance':
    case 'early_bird': {
      // Round up to the next tenth so the displayed target beats the raw score.
      const needed = (Math.floor(gap * 10 + 1e-9) + 1) / 10;
      return `Noch ${number(needed)} km${champion.id === 'early_bird' ? ' mit Start vor 08:00 Uhr' : ''} sammeln, um zu führen.`;
    }
    case 'elevation':
      return `Noch ${number(Math.floor(gap) + 1)} Höhenmeter sammeln, um zu führen.`;
    case 'time':
      return `Noch ${number(Math.floor(gap * 60 + 1e-9) + 1)} Minuten Bewegungszeit sammeln, um zu führen.`;
    case 'consistency': {
      if (leader >= 7) return 'Die Führung liegt bei 7 Trainingstagen. Diese Woche ist nur noch Gleichstand möglich.';
      const days = Math.floor(gap) + 1;
      return `Noch an ${days} weiteren ${days === 1 ? 'Tag' : 'Tagen'} dieser Woche trainieren, um zu führen. Jeder Kalendertag zählt einmal.`;
    }
    case 'heartrate':
      return leader > 0
        ? `Dein höchster Ø-Puls: ${number(ownValue)} bpm. Die Führung liegt bei ${number(leader)} bpm; nötig wäre ein höherer Aktivitätsdurchschnitt. Trainiere nach deinem eigenen Belastungsgefühl.`
        : 'Noch keine Pulswertung. Eine Aktivität mit aufgezeichnetem Durchschnittspuls zählt für diese Kategorie.';
    default:
      return '';
  }
}
