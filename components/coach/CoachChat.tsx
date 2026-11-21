'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, ChevronDown, Mic, Square } from 'lucide-react';
import { COACH_CONSENT_VERSION, joinDictation, type CoachQuota, type CoachSettings } from '@/apps/mobile/src/coach/contracts';
import { coachQuotaLabel, currentCoachQuota, mergeCoachQuota, refreshDailyCoachSettings } from '@/apps/mobile/src/coach/settings-cache';
import { xaiPolygons, xaiViewBox } from '@/apps/mobile/src/coach/xai-mark';
import { useBrowserDictation } from './useBrowserDictation';

const endpoint = '/api/coach/chat';
const settingsStorage = {
  read: (key: string) => localStorage.getItem(key),
  write: (key: string, value: string) => localStorage.setItem(key, value),
};
const button = 'rounded-lg bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-50';
const primary = 'rounded-lg bg-orange-500 px-3 py-2 text-sm font-bold text-zinc-950 hover:bg-orange-400 disabled:opacity-50';
type Conversation = { id: string; title: string };
type Plan = { id: string; status: string };
type Turn = {
  id: string; conversationId: string; question: string; answer?: string; status: string;
  proposal?: { title: string; weeklyAvailability: number; targetDate?: string; goalDescription?: string };
  plan?: Plan; sources?: { url: string; label: string }[];
};
type Page = { conversation: Conversation; turns: Turn[]; hasMore: boolean };
type ConversationList = { conversations: Conversation[]; hasMore: boolean };
type Send = { question: string; requestId: string; conversationId?: string; modelId?: string };
type Event = { conversation?: Conversation; turn?: Turn; text?: string; error?: string; quota?: Partial<CoachQuota> };

class CoachError extends Error {
  constructor(message: string, readonly status: number, readonly quota?: CoachQuota) { super(message); }
}

async function read<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new CoachError(data?.error ?? 'Der Coach ist gerade nicht verfügbar.', response.status, data?.quota);
  return data;
}

function url(filters: Record<string, string>) {
  return endpoint + '?' + new URLSearchParams(filters);
}

function post(body: unknown) {
  return fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export function CoachChat({ userId, onPlanChanged, onOpenPlan }: {
  userId: string;
  onPlanChanged: () => void;
  onOpenPlan: () => void;
}) {
  const consentKey = `coach-consent:${userId}`;
  const modelKey = `coach-model:${userId}`;
  const [consent, setConsent] = useState(false);
  const [settings, setSettings] = useState<CoachSettings>();
  const [quota, setQuota] = useState<Partial<CoachQuota>>();
  const remaining = currentCoachQuota(quota);
  const [modelId, setModelId] = useState('');
  const [conversation, setConversation] = useState<Conversation>();
  const [list, setList] = useState<ConversationList>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [older, setOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [partial, setPartial] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Send>();
  const [error, setError] = useState('');
  const action = useRef(false);
  const standard = settings?.models.find(model => model.id === settings.defaultModelId);
  const selected = settings?.models.find(model => model.id === modelId);
  const activeModel = selected ?? standard;
  const dictation = useBrowserDictation(text => setDraft(current => joinDictation(current, text)));

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setConsent(localStorage.getItem(consentKey) === COACH_CONSENT_VERSION);
        setModelId(localStorage.getItem(modelKey) ?? '');
      } catch { /* Preferences may be blocked by the browser. */ }
    }, 0);
    return () => clearTimeout(timer);
  }, [consentKey, modelKey]);

  useEffect(() => {
    if (!consent) return;
    const key = `coach-settings-v1:${userId}`;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let running = false;
    async function refreshVisible() {
      if (document.hidden || stopped || running) return;
      clearTimeout(timer);
      running = true;
      try {
        const next = await refreshDailyCoachSettings(key, settingsStorage,
          async signal => read<unknown>(await fetch(url({ settings: '1' }), { signal })),
          (value, fresh) => {
            if (stopped) return;
            setSettings(value);
            setQuota(current => fresh || !currentCoachQuota(current) ? currentCoachQuota(value.quota) : current);
          },
          navigator.locks ? async (name, refresh) => await navigator.locks.request(name, refresh) : undefined);
        if (!stopped) timer = setTimeout(() => { void refreshVisible(); }, Math.max(0, next - Date.now()));
      } catch { /* Settings refresh again when the Coach becomes visible. */ }
      finally { running = false; }
    }
    timer = setTimeout(() => { void refreshVisible(); }, 0);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [consent, userId]);

  function remember(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* Preferences may be blocked by the browser. */ }
  }

  const resetsAt = quota?.resetsAt;
  useEffect(() => {
    if (!resetsAt) return;
    const timer = setTimeout(() => setQuota(current => currentCoachQuota(current)), Math.max(0, Date.parse(resetsAt) - Date.now() + 10));
    return () => clearTimeout(timer);
  }, [resetsAt]);

  function applyQuota(next: Partial<CoachQuota>) {
    setQuota(current => mergeCoachQuota(current, next));
  }

  async function perform(work: () => Promise<void>, onError?: (error: unknown) => void) {
    if (action.current) return;
    action.current = true;
    setBusy(true);
    setError('');
    try { await work(); }
    catch (cause) {
      if (cause instanceof CoachError && cause.quota) applyQuota(cause.quota);
      onError?.(cause);
      setError(cause instanceof Error ? cause.message : 'Der Coach ist gerade nicht verfügbar.');
    } finally {
      action.current = false;
      setBusy(false);
    }
  }

  async function openConversation(id: string, before?: string) {
    const page = await read<Page>(await fetch(url({ conversation: id, ...(before ? { before } : {}) })));
    setTurns(current => before ? [...page.turns, ...current] : page.turns);
    setConversation(page.conversation);
    setOlder(page.hasMore);
  }

  async function listConversations(before?: string) {
    const data = await read<ConversationList>(await fetch(url(before ? { before } : {})));
    setList(current => before && current
      ? { ...data, conversations: [...current.conversations, ...data.conversations] }
      : data);
  }

  function startNew() {
    setConversation(undefined);
    setTurns([]);
    setDraft('');
    setOlder(false);
    setPending(undefined);
    setError('');
  }

  function updateTurn(turn: Turn) {
    setTurns(current => current.some(item => item.id === turn.id)
      ? current.map(item => item.id === turn.id ? { ...item, ...turn } : item) : [...current, turn]);
  }

  function send(request: Send) {
    return perform(async () => {
      setPending(request);
      setDraft('');
      setPartial('');
      try {
        const response = await post({ ...request, consent: COACH_CONSENT_VERSION });
        if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
          const { turn } = await read<{ turn: Turn }>(response);
          await openConversation(turn.conversationId);
          setPending(undefined);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Antwort konnte nicht geöffnet werden.');
        const decoder = new TextDecoder();
        let buffer = '';
        let finished = false;
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line) continue;
            const data = JSON.parse(line) as Event;
            if (data.conversation) setConversation(data.conversation);
            if (data.quota) applyQuota(data.quota);
            if (data.text) setPartial(current => current + data.text);
            if (data.turn) {
              updateTurn(data.turn);
              finished = data.turn.status !== 'PENDING';
            }
            if (data.error) setError(data.error);
          }
        }
        if (!finished) throw new Error('Die Verbindung wurde unterbrochen. Lade die Antwort erneut.');
        setPending(undefined);
      } finally {
        setPartial('');
      }
    }, cause => {
      if (cause instanceof CoachError && (cause.status < 500 || cause.status === 503)) {
        setPending(undefined);
        setDraft(request.question);
        if (cause.status === 422) {
          setModelId('');
          remember(modelKey, '');
        }
      }
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || pending || busy || dictation.listening || dictation.starting
        || remaining?.messages === 0 || (selected?.premium && remaining?.premiumMessages === 0)) return;
    void send({ question, requestId: crypto.randomUUID(), conversationId: conversation?.id, modelId: selected?.id });
  }

  function confirmPlan(turn: Turn) {
    return perform(async () => {
      const result = await read<{ planId: string; status: string; quota?: CoachQuota }>(
        await post({ action: 'confirm', turnId: turn.id }),
      );
      if (result.quota) applyQuota(result.quota);
      updateTurn({ ...turn, plan: { id: result.planId, status: result.status } });
      onPlanChanged();
    });
  }

  if (!consent) {
    return <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="font-bold text-white">KI-Chat aktivieren</h2>
      <p className="text-sm leading-relaxed text-zinc-300">Für Antworten verarbeitet xAI deine Chatnachrichten und je nach Frage relevante Ausschnitte aus deinem Trainingsprofil, Strava-Aktivitäten, freigegebenen Gesundheitsdaten, persönlichen Arena-Ergebnissen und Trainingsplänen. Deine Gespräche werden in deinem DorfDüsen-Konto gespeichert und können gelöscht werden.</p>
      <button type="button" className={primary} onClick={() => { remember(consentKey, COACH_CONSENT_VERSION); setConsent(true); }}>
        Zustimmen und Chat nutzen
      </button>
    </section>;
  }

  const controlsLocked = busy || dictation.listening || dictation.starting;
  const waiting = turns.some(turn => turn.status === 'PENDING' || turn.plan?.status === 'QUEUED' || turn.plan?.status === 'PROCESSING');

  return <section aria-label="Smart Coach Chat" className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
    <div className="flex flex-wrap gap-2">
      <button type="button" className={button} disabled={controlsLocked} onClick={() => {
        if (list) setList(undefined);
        else void perform(() => listConversations());
      }}>{list ? 'Zum Chat' : 'Gespräche'}</button>
      <button type="button" className={button} disabled={controlsLocked} onClick={() => { setList(undefined); startNew(); }}>
        Neues Gespräch
      </button>
    </div>
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    {list ? <div className="space-y-2">
      {list.conversations.length === 0 && <p className="text-sm text-zinc-400">Du hast noch keine Gespräche.</p>}
      {list.conversations.map(item => <div key={item.id} className="flex flex-wrap justify-between gap-2">
        <button type="button" className={button} disabled={busy} onClick={() => void perform(async () => {
          await openConversation(item.id);
          setDraft('');
          setPending(undefined);
          setList(undefined);
        })}>{item.title}</button>
        <button type="button" className={button} disabled={busy} onClick={() => {
          if (!window.confirm('Dieses Gespräch löschen?')) return;
          void perform(async () => {
            await read(await fetch(url({ conversation: item.id }), { method: 'DELETE' }));
            if (conversation?.id === item.id) startNew();
            await listConversations();
          });
        }}>Löschen</button>
      </div>)}
      {list.hasMore && <button type="button" className={button} disabled={busy}
        onClick={() => void perform(() => listConversations(list.conversations.at(-1)?.id))}>Weitere Gespräche laden</button>}
    </div> : <>
      <div className="space-y-4">
        {!turns.length && <p className="text-sm text-zinc-400">Frag nach deinem Training oder bitte den Coach um einen Trainingsplan.</p>}
        {older && conversation && <button type="button" className={button} disabled={busy}
          onClick={() => void perform(() => openConversation(conversation.id, turns[0]?.id))}>Ältere Nachrichten laden</button>}
        {turns.map(turn => <div key={turn.id} className="space-y-2">
          <p className="ml-auto w-fit max-w-[90%] whitespace-pre-wrap wrap-break-word rounded-xl bg-orange-950 px-3 py-2 text-zinc-100">{turn.question}</p>
          {turn.answer && <p className="whitespace-pre-wrap wrap-break-word rounded-xl bg-zinc-800 p-3 text-zinc-100">{turn.answer}</p>}
          {turn.status === 'FAILED' && <button type="button" className={button} disabled={controlsLocked} onClick={() => setDraft(turn.question)}>Nachricht erneut schreiben</button>}
          {turn.sources?.filter(item => /^https:\/\/www\.strava\.com\/activities\/\d+$/.test(item.url)).map(source =>
            <a className="block text-sm text-orange-400 underline" key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} · Strava</a>)}
          {turn.proposal && <div className="space-y-2 rounded-xl border border-zinc-700 p-3">
            <p className="font-semibold text-white">{turn.proposal.title}</p>
            <p className="text-sm text-zinc-300">{turn.proposal.weeklyAvailability} Einheiten pro Woche{turn.proposal.targetDate ? ` · Zieltermin ${turn.proposal.targetDate}` : ''}</p>
            {turn.proposal.goalDescription && <p className="text-sm text-zinc-300">{turn.proposal.goalDescription}</p>}
            {turn.plan ? <p className="text-sm text-zinc-300">
              {turn.plan.status === 'FAILED' ? 'Planerstellung fehlgeschlagen.' :
                ['QUEUED', 'PROCESSING'].includes(turn.plan.status) ? 'Der Plan wird erstellt.' :
                  turn.plan.status === 'ACTIVE' ? <button type="button" className={button} onClick={onOpenPlan}>Zum Trainingsplan</button> :
                    'Diesen Trainingsplan hast du bereits erstellt.'}
            </p> : <button type="button" className={primary} disabled={controlsLocked || remaining?.plans === 0}
              onClick={() => void confirmPlan(turn)}>Plan erstellen</button>}
          </div>}
        </div>)}
        {partial && <p className="whitespace-pre-wrap wrap-break-word rounded-xl bg-zinc-800 p-3 text-zinc-100">{partial}</p>}
        {busy && pending && !partial && <p role="status" className="text-sm text-zinc-400">Der Coach antwortet …</p>}
        {pending && !busy && <button type="button" className={button} disabled={controlsLocked} onClick={() => void send(pending)}>Antwort erneut laden</button>}
        {waiting && conversation && !busy && !pending && <button type="button" className={button}
          onClick={() => void perform(() => openConversation(conversation.id))}>Status aktualisieren</button>}
      </div>
      <form onSubmit={submit} className="space-y-2 border-t border-zinc-800 pt-3">
        {remaining && <p className="text-xs text-zinc-400">{coachQuotaLabel(remaining)}</p>}
        {dictation.message && <p role="status" className="text-sm text-zinc-300">{dictation.message}</p>}
        {dictation.canDownload && <button type="button" className={button} onClick={() => void dictation.download()}>Deutsch herunterladen</button>}
        <textarea className="block w-full resize-y rounded-lg border border-zinc-500 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400" aria-label="Nachricht an den Coach" placeholder="Deine Nachricht" rows={3}
          value={joinDictation(draft, dictation.interim)} maxLength={3000} readOnly={dictation.listening} onChange={event => setDraft(event.target.value)} />
        <div className="flex items-center justify-between gap-2">
          <label className="relative inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-2 text-white focus-within:ring-2 focus-within:ring-orange-500"
            title={activeModel?.label ?? 'xAI'}>
            <svg viewBox={xaiViewBox} width={14} height={16} aria-hidden="true" fill="currentColor">
              {xaiPolygons.map(points => <polygon key={points} points={points} />)}
            </svg>
            <span className="truncate text-sm">{activeModel?.label ?? 'xAI'}</span>
            <ChevronDown size={12} className="shrink-0" aria-hidden />
            <select className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
              aria-label="xAI-Modell auswählen" value={activeModel?.id ?? ''} disabled={!activeModel || busy || Boolean(pending)} onChange={event => {
                const nextModelId = event.target.value === standard?.id ? '' : event.target.value;
                setModelId(nextModelId);
                remember(modelKey, nextModelId);
              }}>
              {settings?.models.map(model => <option key={model.id} value={model.id}>
                {model.label}
              </option>)}
            </select>
          </label>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" className={`${button} inline-flex size-11 items-center justify-center`} aria-pressed={dictation.listening}
              aria-label={dictation.listening ? 'Diktat beenden' : 'Nachricht diktieren'}
              title={dictation.listening ? 'Diktat beenden' : 'Nachricht diktieren'}
              disabled={dictation.starting || busy} onClick={() => void dictation.toggle()}>
              {dictation.listening ? <Square size={18} aria-hidden /> : <Mic size={18} aria-hidden />}
            </button>
            <button className={`${primary} inline-flex size-11 items-center justify-center`} type="submit"
              aria-label="Nachricht senden" title="Nachricht senden"
              disabled={controlsLocked || Boolean(pending) || !draft.trim()
                || remaining?.messages === 0 || Boolean(selected?.premium && remaining?.premiumMessages === 0)}>
              <ArrowUp size={20} strokeWidth={2.5} aria-hidden />
            </button>
          </div>
        </div>
      </form>
    </>}
  </section>;
}
