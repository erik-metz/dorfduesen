'use client';

import { useEffect, useState } from 'react';
import type { PersonalWeek } from '@/lib/arena/highlight-presentation';

export function WeeklyGoal() {
  const [personal, setPersonal] = useState<PersonalWeek | null>(null);
  const [days, setDays] = useState(2);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/arena/champions/me', { cache: 'no-store', signal: controller.signal })
      .then(async res => { if (!res.ok) throw new Error('Dein Wochenziel konnte nicht geladen werden.'); return res.json(); })
      .then(data => { if (!controller.signal.aborted) { setPersonal(data); setDays(data.nextGoal ?? 2); } })
      .catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, []);
  async function save() {
    setSaving(true); setMessage('');
    try {
      const res = await fetch('/api/arena/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activeDays: days }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Speichern fehlgeschlagen.');
      setPersonal(p => p ? { ...p, nextGoal: data.goal.activeDays, nextWeek: data.goal.weekKey } : p);
      setMessage('Steht. Nächste Woche wird durchgezogen.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.'); }
    finally { setSaving(false); }
  }
  return <section id="wochenziel" className="scroll-mt-24 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
    <h3 className="text-xl font-black text-white">🎯 Vorgenommen. Durchgezogen.</h3>
    <p className="mt-2 text-sm text-zinc-400">Deine Woche. Dein Ziel. Wie oft willst du raus?</p>
    {personal ? <>
      <p className="mt-3 text-sm text-zinc-300">{personal.currentGoal ? `Diese Woche: ${personal.activeDays} von ${personal.currentGoal} aktiven Tagen geschafft.` : 'Diese Woche zählt jeder aktive Tag. Dein eigenes Ziel startet nächste Woche.'}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label htmlFor="weekly-goal" className="text-sm text-zinc-300">Ab {personal.nextWeek.split('-').reverse().join('.')}:</label>
        <select id="weekly-goal" value={days} onChange={e => setDays(Number(e.target.value))} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
          {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n} {n === 1 ? 'aktiver Tag' : 'aktive Tage'}</option>)}
        </select>
        <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold hover:bg-orange-500 disabled:opacity-50">{saving ? 'Speichert …' : 'Ziel festmachen'}</button>
      </div>
      <p className="mt-3 text-xs text-zinc-500">Bis Montag kannst du’s ändern. Danach steht’s. Ruhetage gehören dazu.</p>
    </> : !message ? <p className="mt-3 text-sm text-zinc-400">Dein Wochenziel wird geladen …</p> : null}
    <p role="status" className="mt-2 text-sm text-orange-200">{message}</p>
  </section>;
}
