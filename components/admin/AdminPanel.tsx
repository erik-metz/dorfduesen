'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Check, Clock, ShieldCheck, Trash2, User as UserIcon, X } from 'lucide-react';
import { ModalDialog } from '@/components/ModalDialog';
import { isValidAvatarUrl } from '@/lib/utils/avatar';
import type { AccessOverview } from '@/lib/admin/access';

type Request = AccessOverview['pending'][number];
type Member = AccessOverview['members'][number];

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' });

function personName(person: { firstname: string | null; lastname: string | null; username: string | null }) {
  return [person.firstname, person.lastname].filter(Boolean).join(' ') || person.username || 'Unbekannt';
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  if (isValidAvatarUrl(src)) {
    return (
      <div className="relative w-10 h-10 shrink-0 rounded-full overflow-hidden ring-1 ring-zinc-700">
        <Image src={src!} alt={name} fill unoptimized className="object-cover" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 shrink-0 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center">
      <UserIcon className="w-4 h-4" />
    </div>
  );
}

function Section({ title, count, children, empty }: { title: string; count: number; children: React.ReactNode; empty: string }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-black uppercase tracking-wider text-zinc-400">
        {title} <span className="text-zinc-500">({count})</span>
      </h2>
      {count === 0 ? <p className="text-sm text-zinc-500 rounded-2xl border border-zinc-800 px-4 py-5">{empty}</p> : <ul className="space-y-2">{children}</ul>}
    </section>
  );
}

export function AdminPanel({ initialOverview, currentUserId }: { initialOverview: AccessOverview; currentUserId: string }) {
  const [overview, setOverview] = useState(initialOverview);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmMember, setConfirmMember] = useState<Member | null>(null);

  async function run(id: string, request: () => Promise<Response>) {
    setBusyId(id);
    setError(null);
    try {
      const response = await request();
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || 'Die Aktion ist fehlgeschlagen.');
      }
      const refreshed = await fetch('/api/admin/access', { cache: 'no-store' });
      if (refreshed.ok) setOverview(await refreshed.json() as AccessOverview);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Die Aktion ist fehlgeschlagen.');
    } finally {
      setBusyId(null);
    }
  }

  const decide = (request: Request, action: 'approve' | 'reject') => run(request.id, () => fetch(`/api/admin/access/${request.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  }));

  const remove = (member: Member) => run(member.id, () => fetch(`/api/admin/members/${member.id}`, { method: 'DELETE' }));

  function RequestRow({ request }: { request: Request }) {
    const name = personName(request);
    const busy = busyId === request.id;
    const rejected = request.status === 'REJECTED';
    return (
      <li className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar src={request.profile} name={name} />
          <div className="min-w-0">
            <p className="font-bold text-white truncate">{name}</p>
            <p className="text-xs text-zinc-400">
              {[request.city, `Strava ${request.stravaAthleteId}`].filter(Boolean).join(' · ')}
            </p>
            <p className="text-xs text-zinc-500">
              {request.attemptCount > 0
                ? `Letzter Versuch ${dateFormat.format(new Date(request.lastAttemptAt))} · ${request.attemptCount} ${request.attemptCount === 1 ? 'Versuch' : 'Versuche'}`
                : 'Als Mitglied entfernt'}
              {rejected && request.decidedAt ? ` · abgelehnt ${dateFormat.format(new Date(request.decidedAt))}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" disabled={busy} onClick={() => void decide(request, 'approve')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-2 text-xs font-bold text-white">
            <Check className="w-4 h-4" /> {rejected ? 'Doch freigeben' : 'Freigeben'}
          </button>
          {!rejected && (
            <button type="button" disabled={busy} onClick={() => void decide(request, 'reject')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 hover:bg-zinc-800 disabled:opacity-50 px-3 py-2 text-xs font-bold text-zinc-200">
              <X className="w-4 h-4" /> Ablehnen
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-8">
      {error && <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      <Section title="Offene Anfragen" count={overview.pending.length} empty="Keine offenen Anfragen.">
        {overview.pending.map((request) => <RequestRow key={request.id} request={request} />)}
      </Section>

      <Section title="Abgelehnt" count={overview.rejected.length} empty="Keine abgelehnten Anmeldeversuche.">
        {overview.rejected.map((request) => <RequestRow key={request.id} request={request} />)}
      </Section>

      <Section title="Mitglieder" count={overview.members.length} empty="Noch keine Mitglieder.">
        {overview.members.map((member) => {
          const name = personName(member);
          const canRemove = member.id !== currentUserId && member.role !== 'ADMIN';
          return (
            <li key={member.id} className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
              <Avatar src={member.profile} name={name} />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white truncate flex items-center gap-1.5">
                  {name}
                  {member.role === 'ADMIN' && <ShieldCheck className="w-4 h-4 text-orange-400" aria-label="Admin" />}
                </p>
                <p className="text-xs text-zinc-400">
                  {member.connected ? `${member.activityCount} Aktivitäten` : (
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Freigegeben, noch nicht angemeldet</span>
                  )}
                  {member.city ? ` · ${member.city}` : ''}
                </p>
              </div>
              {canRemove && (
                <button type="button" disabled={busyId === member.id} onClick={() => setConfirmMember(member)}
                  aria-label={`${name} entfernen`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 hover:border-red-500/60 hover:bg-red-500/10 disabled:opacity-50 px-3 py-2 text-xs font-bold text-zinc-300 hover:text-red-200">
                  <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Entfernen</span>
                </button>
              )}
            </li>
          );
        })}
      </Section>

      {confirmMember && (
        <ModalDialog onClose={() => setConfirmMember(null)} labelledBy="remove-member-title" describedBy="remove-member-text"
          className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
          <h2 id="remove-member-title" className="text-lg font-black text-white">{personName(confirmMember)} entfernen?</h2>
          <p id="remove-member-text" className="text-sm text-zinc-400">
            Alle Aktivitäten, Trophäen und Pläne dieses Mitglieds werden gelöscht und die Strava-Verbindung getrennt.
            Die Person landet unter „Abgelehnt“ und kann dort später wieder freigegeben werden.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmMember(null)}
              className="rounded-xl border border-zinc-700 hover:bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-200">Abbrechen</button>
            <button type="button" onClick={() => { const member = confirmMember; setConfirmMember(null); void remove(member); }}
              className="rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2 text-sm font-bold text-white">Entfernen</button>
          </div>
        </ModalDialog>
      )}
    </div>
  );
}
