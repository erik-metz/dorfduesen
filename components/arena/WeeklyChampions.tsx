'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { ChampionTitle } from '@/lib/arena/stats';
import { championProgress } from '@/lib/arena/champion-progress';
import { isValidAvatarUrl } from '@/lib/utils/avatar';

type Personal = { userId: string; values: Record<string, number>; achievements: string[]; nextWeek: string; nextGoal: number | null; currentGoal: number | null };
type Person = { athlete: NonNullable<ChampionTitle['winner']>; titles: ChampionTitle[] };

export function WeeklyChampions({ champions, currentUserId }: { champions: ChampionTitle[]; currentUserId?: string | null }) {
  const [personal, setPersonal] = useState<Personal | null>(null);
  const [days, setDays] = useState(2);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/arena/champions/me', { cache: 'no-store', signal: controller.signal })
      .then(async res => {
        if (res.status === 401) return null;
        if (!res.ok) throw new Error('load');
        return res.json();
      })
      .then(data => {
        if (data?.userId && !controller.signal.aborted) { setPersonal(data); setDays(data.nextGoal ?? 2); }
      })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, []);

  const performances = champions.filter(c => c.kind !== 'recognition');
  const recognitions = champions.filter(c => c.kind === 'recognition');
  const newRules = recognitions.length > 0;
  const people = new Map<string, Person>();
  for (const title of performances) {
    for (const athlete of title.recipients ?? (title.winner ? [title.winner] : [])) {
      const person = people.get(athlete.userId) ?? { athlete, titles: [] };
      person.titles.push(title); people.set(athlete.userId, person);
    }
  }
  // One card per person; additional achievements are listed on that same card.
  const celebrated = new Map<string, Person>();
  for (const title of recognitions) {
    for (const athlete of title.recipients ?? []) {
      const person = celebrated.get(athlete.userId) ?? { athlete, titles: [] };
      person.titles.push(title); celebrated.set(athlete.userId, person);
      if (people.has(athlete.userId)) people.get(athlete.userId)!.titles.push(title);
    }
  }
  const spotlight = new Map<string, Person>();
  // Round-robin categories; recipients with fewer previous awards come first.
  const max = Math.max(0, ...recognitions.map(c => c.recipients?.length ?? 0));
  for (let i = 0; i < max && spotlight.size < 6; i++) {
    for (const title of recognitions) {
      const athlete = title.recipients?.[i];
      if (athlete && !people.has(athlete.userId) && spotlight.size < 6) spotlight.set(athlete.userId, celebrated.get(athlete.userId)!);
    }
  }
  const userId = personal?.userId ?? currentUserId;
  const renderPerson = ({ athlete, titles }: Person) => (
    <article key={athlete.userId} className={`rounded-3xl border p-6 bg-zinc-900/80 ${athlete.userId === userId ? 'border-orange-500' : 'border-zinc-800'}`}>
      <Link href={athlete.userId === userId ? '/dashboard' : `/dashboard?userId=${athlete.userId}`} className="flex gap-3 items-center font-bold text-white hover:text-orange-300">
        {isValidAvatarUrl(athlete.profile) ? <Image src={athlete.profile!} alt="" width={40} height={40} unoptimized className="rounded-full" /> : <span className="rounded-full bg-orange-500/10 p-3 text-orange-300" aria-hidden="true">{athlete.name.charAt(0)}</span>}
        {athlete.userId === userId ? 'Du' : athlete.name}
      </Link>
      <ul className="mt-4 space-y-3">
        {titles.map(title => {
          const score = title.recipients?.find(r => r.userId === athlete.userId) ?? title.winner;
          return <li key={title.id}>
            <h3 className="font-bold text-white">{title.icon} {title.title}</h3>
            <p className="text-sm text-orange-300">{score?.formattedValue}</p>
            <p className="text-xs text-zinc-400">{title.subtitle}</p>
            {personal && title.kind !== 'recognition' ? <p className="text-xs text-zinc-300 mt-2">{championProgress(title, personal.values[title.id] ?? 0, personal.userId)}</p> : null}
          </li>;
        })}
      </ul>
    </article>
  );
  async function saveGoal() {
    setSaving(true); setMessage('');
    try {
      const res = await fetch('/api/arena/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activeDays: days }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Speichern fehlgeschlagen.');
      setPersonal(p => p ? { ...p, nextGoal: data.goal.activeDays, nextWeek: data.goal.weekKey } : p);
      setMessage('Dein Ziel für nächste Woche ist gespeichert.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.'); }
    finally { setSaving(false); }
  }
  return <section className="space-y-6" aria-labelledby="weekly-highlights">
    <div>
      <p className="text-orange-400 text-xs font-bold uppercase tracking-wider">Leistung · Routine · persönliche Erfolge</p>
      <h2 id="weekly-highlights" className="text-2xl sm:text-4xl font-black text-white">Unsere Wochen-Highlights</h2>
      <p className="text-sm text-zinc-400 mt-2">Jeder Fortschritt zählt. Die Woche läuft von Montag bis Sonntag; Trophäen werden nach Wochenabschluss vergeben.</p>
      {!newRules ? <p className="text-sm text-orange-200 mt-3">Ab 12.10.2026: getrennte Lauf- und Radsiege sowie Ehrungen für alle, die dranbleiben, ihre Routine stärken oder ihr eigenes Ziel erreichen. Diese Woche gelten noch die bisherigen Titel.</p> : null}
    </div>
    {personal ? <div className="rounded-3xl border border-orange-500/30 bg-orange-500/5 p-6 space-y-4">
      <h3 className="font-bold text-white">Deine Woche, dein Ziel</h3>
      {personal.achievements.length ? <p className="text-emerald-300 text-sm">Schon geschafft: {personal.achievements.join(' · ')}. Stark gemacht!</p> : <p className="text-zinc-300 text-sm">Zwei aktive Tage reichen für „Drangeblieben“. Tempo und Kilometer spielen dabei keine Rolle.</p>}
      <p className="text-sm text-zinc-400">{personal.currentGoal ? `Dein festes Ziel diese Woche: ${personal.currentGoal} aktive Tage.` : 'Für diese Woche ist kein persönliches Ziel hinterlegt.'}</p>
      <div className="flex flex-wrap gap-3 items-center">
        <label htmlFor="weekly-goal" className="text-sm">Ziel ab {personal.nextWeek.split('-').reverse().join('.')}:</label>
        <select id="weekly-goal" value={days} onChange={e => setDays(Number(e.target.value))} className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2">
          {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n} {n === 1 ? 'aktiver Tag' : 'aktive Tage'}</option>)}
        </select>
        <button type="button" onClick={saveGoal} disabled={saving} className="rounded-lg bg-orange-600 hover:bg-orange-500 px-4 py-2 font-bold disabled:opacity-50">{saving ? 'Speichert …' : 'Ziel speichern'}</button>
      </div>
      <p className="text-xs text-zinc-400">Wähle ein passendes Ziel. Bis zum Wochenstart kannst du es ändern; danach steht es fest. Ruhetage gehören dazu.</p>
      <p role="status" className="text-sm text-orange-200">{message}</p>
    </div> : loadError ? <p role="status" className="text-sm text-orange-200">Dein persönlicher Wochenstand konnte nicht geladen werden. Bitte versuche es später erneut.</p> : null}
    <div>
      <h3 className="text-xl font-bold text-white mb-4">{newRules ? 'Sportliche Leistungen' : 'Aktuelle Wochentitel'}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{[...people.values()].map(renderPerson)}</div>
      {performances.filter(c => !c.winner).map(c => <p key={c.id} className="text-sm text-zinc-400 mt-3">{c.icon} {c.title}: Noch keine Aktivität in dieser Wertung.</p>)}
    </div>
    {newRules ? <div className="space-y-4">
      <h3 className="text-xl font-bold text-white">Gemeinsam feiern</h3>
      <p className="text-sm text-zinc-400">Alle passenden Erfolge werden gewürdigt. Im Rampenlicht stehen bis zu sechs weitere Menschen; wer bisher weniger Ehrungen hatte, wird innerhalb einer Kategorie zuerst gezeigt.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{[...spotlight.values()].map(renderPerson)}</div>
      {celebrated.size === 0 ? <p className="text-sm text-zinc-400">Die Woche hat noch Platz für deine Erfolge. Jeder aktive Tag zählt.</p> : null}
      <details className="rounded-2xl border border-zinc-800 p-4">
        <summary className="cursor-pointer font-bold">Alle persönlichen Ehrungen dieser Woche ({celebrated.size} Personen)</summary>
        <ul className="mt-4 space-y-3 text-sm">{[...celebrated.values()].map(({ athlete, titles }) => <li key={athlete.userId}><Link className="text-orange-300 hover:underline" href={`/dashboard?userId=${athlete.userId}`}>{athlete.name}</Link>: {titles.map(t => `${t.icon} ${t.title}`).join(' · ')}</li>)}</ul>
      </details>
      <details className="text-sm text-zinc-400">
        <summary className="cursor-pointer">So funktionieren die Ehrungen</summary>
        <ul className="mt-3 space-y-2">{recognitions.map(c => <li key={c.id}>{c.icon} <strong>{c.title}:</strong> {c.subtitle}.</li>)}</ul>
        <p className="mt-3">Ein Kalendertag zählt einmal, sofern eine Aktivität mit Bewegungszeit aufgezeichnet wurde. Fortschritt wird erst nach vier vollständigen Wochen Mitgliedschaft verglichen; Wochen ohne Training zählen mit null Tagen. Alle Sportarten zählen für persönliche Erfolge. E-Bike-Fahrten zählen nicht zur Radleistung.</p>
      </details>
    </div> : null}
  </section>;
}
