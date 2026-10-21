'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import type { NotificationItem } from '@/types/notification';

export function WeeklyRecapDialog({ notification, onClose }: { notification: NotificationItem; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const weekKey = notification.metadata?.weekKey;
  const weekLabel = weekKey && /^\d{4}-\d{2}-\d{2}$/.test(weekKey)
    ? `Woche ab ${new Date(`${weekKey}T12:00:00Z`).toLocaleDateString('de-DE', { timeZone: 'UTC' })}` : 'Deine Woche';
  const celebration = notification.metadata?.outcome === 'celebration';
  const rawAwards = notification.metadata?.awards;
  const awards = Array.isArray(rawAwards) ? rawAwards.filter((a): a is { title: string; icon: string; formattedValue: string } =>
    a !== null && typeof a === 'object' && typeof a.title === 'string' && typeof a.icon === 'string' && typeof a.formattedValue === 'string') : [];
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  function handleBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    const element = dialog.current;
    if (!element) return;

    // Browsers differ in which element receives a click on the native dialog
    // backdrop. Checking the dialog bounds also handles cases where the event
    // target is not the dialog element itself.
    const bounds = element.getBoundingClientRect();
    const clickedOutside = event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (event.target === element || clickedOutside) onClose();
  }

  return <dialog ref={dialog} aria-labelledby="weekly-recap-title" aria-describedby="weekly-recap-message"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={handleBackdropClick}
    className="weekly-recap-dialog m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl border border-orange-400/40 bg-zinc-950 p-0 text-zinc-100 shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm">
    <div className="relative overflow-hidden p-6 sm:p-8" onClick={event => event.stopPropagation()}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,146,60,0.22),transparent_70%)]" />
      {celebration && <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 20 }, (_, i) => <span key={i} className="weekly-confetti absolute top-0 h-3 w-1.5 rounded-sm"
          style={{ left: `${(i * 37) % 100}%`, backgroundColor: ['#fb923c', '#facc15', '#a78bfa', '#34d399'][i % 4], animationDelay: `${(i % 5) * 0.12}s`, transform: `rotate(${i * 23}deg)` }} />)}
      </div>}
      <button type="button" onClick={onClose} autoFocus aria-label="Wochenrückblick schließen" className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"><X className="h-5 w-5" /></button>
      <div className="relative space-y-5 text-center">
        <p className="pt-3 text-xs font-bold uppercase tracking-widest text-orange-300">Dein Wochenrückblick · {weekLabel}</p>
        <div aria-hidden="true" className={`${celebration ? 'weekly-trophy-pop' : 'weekly-recap-rise'} mx-auto flex h-24 w-24 items-center justify-center rounded-3xl border border-orange-300/30 bg-orange-400/10 text-6xl shadow-lg shadow-orange-500/15`}>{celebration ? '🏆' : '🚀'}</div>
        <h2 id="weekly-recap-title" className="text-2xl font-black sm:text-3xl">{notification.title}</h2>
        <p id="weekly-recap-message" className="text-sm leading-relaxed text-zinc-300">{notification.message}</p>
        {awards.length > 0 && <ul className="space-y-2 text-left">{awards.map((award, i) => <li key={`${award.title}-${i}`} className="weekly-recap-rise flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3" style={{ animationDelay: `${0.2 + i * 0.1}s` }}>
          <span aria-hidden="true" className="text-3xl">{award.icon}</span><div><p className="text-sm font-bold text-amber-200">{award.title}</p><p className="text-xs text-zinc-400">{award.formattedValue}</p></div>
        </li>)}</ul>}
        <Link href={notification.link || '/arena'} onClick={onClose} className="block rounded-2xl bg-orange-600 px-4 py-3 font-bold hover:bg-orange-500">{celebration ? 'Deine Trophäen ansehen' : 'Auf in die neue Woche'}</Link>
        <button type="button" onClick={onClose} className="min-h-11 px-4 text-sm text-zinc-400 hover:text-white">{celebration ? 'Danke, weiter geht’s!' : 'Ich bin dabei'}</button>
      </div>
    </div>
  </dialog>;
}
