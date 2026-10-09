'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { ChampionTitle } from '@/lib/arena/stats';
import { highlightCards, highlightHint, type PersonalWeek } from '@/lib/arena/highlight-presentation';
import { isValidAvatarUrl } from '@/lib/utils/avatar';

type Card = ReturnType<typeof highlightCards>[number];
export function WeeklyChampions({ champions, currentUserId }: { champions: ChampionTitle[]; currentUserId?: string | null }) {
  const [personal, setPersonal] = useState<PersonalWeek | null>(null);
  const [selected, setSelected] = useState<Card | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/arena/champions/me', { cache: 'no-store', signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.userId && !controller.signal.aborted) setPersonal(data); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const userId = personal?.userId ?? currentUserId;
  const cards = highlightCards(champions);
  function open(card: Card) { setSelected(card); dialog.current?.showModal(); }
  return <section aria-labelledby="weekly-champions" className="space-y-5">
    <div>
      <h2 id="weekly-champions" className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white">Die Champions der Woche</h2>
      <p className="mt-2 text-sm text-zinc-400">Kilometer gefressen. Sofa besiegt. Hier wird beides gefeiert.</p>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {cards.map(card => {
        const { champion, featured, recipients } = card;
        const achieved = Boolean(userId && recipients.some(r => r.userId === userId)) || Boolean(personal?.achievements.includes(champion.title));
        const hint = personal ? highlightHint(champion, personal) : null;
        const value = featured
          ? `${featured.formattedValue}${champion.id === 'run_distance' ? ' gelaufen' : champion.id === 'ride_distance' ? ' auf dem Rad' : ''}`
          : 'Hier ist noch Platz für deinen Namen.';
        return <button key={champion.id} type="button" onClick={() => open(card)} aria-haspopup="dialog"
          className={`group min-w-0 min-h-[230px] sm:min-h-[250px] rounded-2xl sm:rounded-3xl border p-3 sm:p-5 text-left flex flex-col transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400 ${achieved ? 'border-orange-500/60 bg-orange-950/20' : 'border-zinc-800 bg-zinc-900/80 hover:border-orange-500/50'}`}>
          <span className="text-3xl sm:text-4xl" aria-hidden="true">{champion.icon}</span>
          <h3 className="mt-3 min-h-12 text-base sm:text-xl font-black leading-tight text-white">{champion.title}</h3>
          <div className="mt-3 flex items-center gap-2 min-w-0">
            {featured ? isValidAvatarUrl(featured.profile)
              ? <Image src={featured.profile!} alt="" width={28} height={28} unoptimized className="rounded-full shrink-0" />
              : <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-xs font-bold text-orange-300">{featured.name.charAt(0)}</span>
              : null}
            <span className="truncate text-sm font-bold text-white" title={featured?.name}>{featured ? featured.userId === userId ? 'Du' : featured.name : 'Dein Platz?'}</span>
          </div>
          <p className="mt-1.5 text-xs sm:text-sm font-semibold text-orange-300">{value}</p>
          <div className="mt-auto pt-3">
            {hint ? <p className={`text-xs leading-relaxed ${achieved ? 'text-emerald-300' : 'text-zinc-400'}`}>{hint}</p> : null}
            <span className="mt-2 block text-[11px] text-zinc-500 group-hover:text-orange-300">{recipients.length > 1 ? `+${recipients.length - 1} Düsen haben’s auch durchgezogen` : 'Ansehen →'}</span>
          </div>
        </button>;
      })}
    </div>
    <dialog ref={dialog} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-lg max-h-[85dvh] overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-950 p-6 text-zinc-100 backdrop:bg-black/75" aria-labelledby="champion-dialog-title">
      {selected ? <>
        <div className="flex items-start justify-between gap-4">
          <h3 id="champion-dialog-title" className="text-2xl font-black">{selected.champion.icon} {selected.champion.title}</h3>
          <button type="button" autoFocus onClick={() => dialog.current?.close()} aria-label="Schließen" className="rounded-lg px-3 py-1 text-xl text-zinc-400 hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-orange-400">×</button>
        </div>
        <p className="mt-4 text-sm text-zinc-400">{selected.champion.subtitle}. Montag bis Sonntag zählt; die Trophäe gibt’s nach Wochenabschluss.</p>
        {selected.champion.id === 'progress' ? <p className="mt-2 text-sm text-zinc-400">Verglichen werden vier vollständige Vorwochen, auch Wochen ohne Sport. Neue Düsen sammeln erst vier Wochen Anlauf.</p> : null}
        {selected.champion.kind === 'recognition' ? <p className="mt-2 text-sm text-zinc-400">Ein aktiver Kalendertag zählt einmal – egal welcher Sport, welches Tempo oder wie viele Einheiten. Alle, die es schaffen, bekommen die Ehrung. Im Rampenlicht wechseln wir uns ab.</p> : null}
        <ul className="mt-5 divide-y divide-zinc-800">
          {selected.recipients.map(athlete => <li key={athlete.userId} className="py-3 flex items-center justify-between gap-3 text-sm">
            <Link className="font-bold text-orange-300 hover:underline" href={athlete.userId === userId ? '/dashboard' : `/dashboard?userId=${athlete.userId}`}>{athlete.userId === userId ? 'Du' : athlete.name}</Link>
            <span className="text-right text-zinc-300">{athlete.formattedValue}</span>
          </li>)}
        </ul>
        {!selected.recipients.length ? <p className="mt-4 text-sm text-zinc-300">Hier ist noch Platz für deinen Namen.</p> : null}
        {selected.champion.id === 'goal' ? <Link href="/dashboard?tab=trophies#wochenziel" className="mt-5 inline-block rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold hover:bg-orange-500">Dein nächstes Ziel festlegen →</Link> : null}
      </> : null}
    </dialog>
  </section>;
}
