import { useIsFocused } from 'expo-router/react-navigation';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Keyboard, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { useCoachDictation } from '../../src/coach/useCoachDictation';
import { COACH_CHAT_DAILY_LIMIT, COACH_CONSENT_VERSION as consentVersion, joinDictation, type CoachSettings, type CoachQuota } from '../../src/coach/contracts';

import { coachQuotaLabel, currentCoachQuota, mergeCoachQuota, refreshDailyCoachSettings } from '../../src/coach/settings-cache';

const settingsStorage = { read: AsyncStorage.getItem, write: AsyncStorage.setItem };
const endpoint = '/api/mobile/coach';
const examples = ['Wie hat sich mein Training in den letzten acht Wochen entwickelt?', 'Hilf mir, einen 10-km-Trainingsplan zu erstellen.'];
const planStatuses: Record<string, string> = {
  QUEUED: 'Wartet', PROCESSING: 'Wird erstellt', ACTIVE: 'Fertig', PAUSED: 'Pausiert', COMPLETED: 'Abgeschlossen', FAILED: 'Fehlgeschlagen',
};
const weekdays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

type Conversation = { id: string; title: string };
type Plan = { id: string; title: string; status: string; totalWeeks: number };
type Proposal = {
  title: string; weeklyAvailability: number; preferredLongRunDay?: number; targetDate?: string;
  goalDescription?: string; targetDistance?: number; targetTimeSeconds?: number; includeSundayRun?: boolean;
};
type Turn = {
  id: string; conversationId: string; question: string; answer?: string; status: string;
  proposal?: Proposal; sources?: { label: string; url: string }[]; plan?: Plan;
};
type Week = {
  weekNumber: number; phase: string; focusTitle: string | null; targetDistance: number; actualDistance: number;
  workouts: { scheduledDate: string; title: string; description: string; sportType: string; status: string; targetDistance: number | null; targetDurationMinutes: number | null; targetPaceMin: string | null; targetPaceMax: string | null; targetHrZone: number | null }[];
};
type ChatPage = { conversation: Conversation; turns: Turn[]; hasMore: boolean };
type ConversationPage = { conversations: Conversation[]; hasMore: boolean };
type SendEvent = { conversation?: Conversation; turn?: Turn; text?: string; error?: string; quota?: Partial<CoachQuota> };
type PendingSend = { requestId: string; question: string; conversationId?: string; modelId?: string };

function url(params: Record<string, string>) {
  return endpoint + '?' + Object.entries(params).map(([key, value]) => key + '=' + encodeURIComponent(value)).join('&');
}

class CoachHttpError extends Error {
  constructor(message: string, readonly status: number, readonly quota?: CoachQuota) { super(message); }
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new CoachHttpError(data?.error ?? 'Der Coach ist gerade nicht erreichbar.', response.status, data?.quota);
  return data as T;
}

function isPlanPending(plan?: Plan) {
  return plan?.status === 'QUEUED' || plan?.status === 'PROCESSING';
}

const dateFormat = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
function formatDate(date: string) {
  return dateFormat.format(new Date(date));
}

function Button({ label, onPress, disabled, primary }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[styles.button, primary && styles.primary, disabled && styles.disabled]}><Text style={primary ? styles.primaryText : styles.accent}>{label}</Text></Pressable>;
}

export default function CoachScreen() {
  const { user } = useAuth();
  return <CoachChat key={user?.id} />;
}

function CoachChat() {
  const { apiFetch, user } = useAuth();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [consent, setConsent] = useState(false);
  const [conversation, setConversation] = useState<Conversation>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [olderTurns, setOlderTurns] = useState(false);
  const [olderConversations, setOlderConversations] = useState(false);
  const [history, setHistory] = useState(false);
  const [draft, setDraft] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const [settings, setSettings] = useState<CoachSettings>();
  const [modelId, setModelId] = useState('');
  const [showModels, setShowModels] = useState(false);
  const [showQuota, setShowQuota] = useState(false);
  const [quota, setQuota] = useState<Partial<CoachQuota>>();
  const remaining = currentCoachQuota(quota);
  const [partial, setPartial] = useState('');
  const [pending, setPending] = useState<PendingSend>();
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [planView, setPlanView] = useState<{ plan: Plan; week: Week | null; number: number }>();
  const scroll = useRef<ScrollView>(null);
  const scrollToLatest = useRef(false);
  const loadHistoryOnScroll = useRef(false);
  const action = useRef(false);
  const initialized = useRef(false);
  const consentKey = `coach-consent:${user?.id}`;
  const conversationKey = `coach-conversation:${user?.id}`;
  const conversationId = conversation?.id;
  const modelKey = `coach-model:${user?.id}`;
  const selected = settings?.models.find(model => model.id === modelId);
  const standard = settings?.models.find(model => model.id === settings.defaultModelId);
  const activeModel = selected ?? standard;
  const dictation = useCoachDictation(focused && consent && !history && !planView, text => {
    setDraft(current => joinDictation(current, text));
  });

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(modelKey).then(value => {
      if (active && value) setModelId(value);
    }).catch(() => {});
    return () => { active = false; };
  }, [modelKey]);

  const accountId = user?.id;
  useEffect(() => {
    if (!focused || !appActive || !consent || !accountId) return;
    const key = `coach-settings-v1:${accountId}`;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      const next = await refreshDailyCoachSettings(key, settingsStorage,
        async signal => readJson<unknown>(await apiFetch(url({ settings: '1' }), { cache: 'no-store', signal })),
        (value, fresh) => {
          if (stopped) return;
          setSettings(value);
          setQuota(current => fresh || !currentCoachQuota(current) ? currentCoachQuota(value.quota) : current);
        });
      if (!stopped) timer = setTimeout(() => { void refresh(); }, Math.max(0, next - Date.now()));
    }
    timer = setTimeout(() => { void refresh(); }, 0);
    return () => { stopped = true; clearTimeout(timer); };
  }, [accountId, apiFetch, appActive, consent, focused]);

  const resetsAt = quota?.resetsAt;
  useEffect(() => {
    if (!resetsAt || !appActive) return;
    const timer = setTimeout(() => setQuota(current => currentCoachQuota(current)), Math.max(0, Date.parse(resetsAt) - Date.now() + 10));
    return () => clearTimeout(timer);
  }, [appActive, resetsAt]);

  const applyQuota = useCallback((next: Partial<CoachQuota>) => {
    setQuota(current => mergeCoachQuota(current, next));
  }, []);

  function selectModel(value: string) {
    setModelId(value);
    setShowModels(false);
    void AsyncStorage.setItem(modelKey, value).catch(() => {});
  }

  const showError = useCallback((cause: unknown) => {
    if (cause instanceof CoachHttpError && cause.quota) applyQuota(cause.quota);
    setError(cause instanceof Error ? cause.message : 'Der Coach ist gerade nicht erreichbar.');
  }, [applyQuota]);

  const loadConversation = useCallback(async (id: string, before?: string) => {
    const page = await readJson<ChatPage>(await apiFetch(url({ conversation: id, ...(before ? { before } : {}) }), { cache: 'no-store' }));
    if (!before) scrollToLatest.current = true;
    setConversation(page.conversation);
    setTurns(current => before ? [...page.turns, ...current] : page.turns);
    setOlderTurns(page.hasMore);
    void AsyncStorage.setItem(conversationKey, id).catch(() => {});
  }, [apiFetch, conversationKey]);

  const loadConversations = useCallback(async (before?: string) => {
    const page = await readJson<ConversationPage>(await apiFetch(url(before ? { before } : {}), { cache: 'no-store' }));
    setConversations(current => before ? [...current, ...page.conversations.filter(item => !current.some(existing => existing.id === item.id))] : page.conversations);
    setOlderConversations(page.hasMore);
    return page.conversations;
  }, [apiFetch]);

  const initialize = useCallback(async () => {
    setBusy(true);
    try {
      const saved = AsyncStorage.getItem(consentKey).then(value => { setConsent(value === consentVersion); });
      const [, last, list] = await Promise.all([saved, AsyncStorage.getItem(conversationKey), loadConversations()]);
      const id = last ?? list[0]?.id;
      if (id) {
        try { await loadConversation(id); }
        catch (cause) {
          if (!(cause instanceof CoachHttpError) || cause.status !== 404) throw cause;
          await AsyncStorage.removeItem(conversationKey);
          if (list[0] && id !== list[0].id) await loadConversation(list[0].id);
        }
      }
    } catch (cause) { showError(cause); }
    finally { setBusy(false); }
  }, [consentKey, conversationKey, loadConversation, loadConversations, showError]);

  useEffect(() => { if (focused && !initialized.current) { initialized.current = true; void initialize(); } }, [focused, initialize]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  const waitingForAnswer = turns.some(turn => turn.status === 'PENDING');
  const waitingPlanId = turns.find(turn => isPlanPending(turn.plan))?.plan?.id;
  const waiting = waitingForAnswer || Boolean(waitingPlanId);

  const refreshPending = useCallback(async (signal?: AbortSignal) => {
    const options: RequestInit = { cache: 'no-store', signal };
    const [page, status] = await Promise.all([
      waitingForAnswer && conversationId
        ? apiFetch(url({ conversation: conversationId }), options).then(readJson<ChatPage>)
        : undefined,
      waitingPlanId
        ? apiFetch(url({ plan: waitingPlanId, status: '1' }), options).then(readJson<{ plan: Plan }>)
        : undefined,
    ]);
    if (signal?.aborted) return false;
    const refreshed = new Map(page?.turns.map(turn => [turn.id, turn]));
    setTurns(current => current.map(turn => {
      const updated = refreshed.get(turn.id) ?? turn;
      return status && updated.plan?.id === status.plan.id ? { ...updated, plan: status.plan } : updated;
    }));
    return Boolean(page?.turns.some(turn => turn.status === 'PENDING') || isPlanPending(status?.plan));
  }, [apiFetch, conversationId, waitingForAnswer, waitingPlanId]);

  useEffect(() => {
    if (!focused || !appActive || history || sending || busy || !waiting) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async (remaining: number) => {
      try {
        const stillWaiting = await refreshPending(controller.signal);
        if (stillWaiting && remaining > 1 && !controller.signal.aborted) {
          timer = setTimeout(() => void refresh(remaining - 1), 6000);
        }
      } catch { /* A manual refresh remains available. */ }
    };
    void refresh(12);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [appActive, busy, focused, history, refreshPending, sending, waiting]);

  async function perform(work: () => Promise<void>) {
    if (action.current) return;
    action.current = true;
    setError('');
    setBusy(true);
    try { await work(); }
    catch (cause) { showError(cause); }
    finally { action.current = false; setBusy(false); }
  }

  function applyTurn(turn: Turn) {
    setTurns(current => current.some(item => item.id === turn.id)
      ? current.map(item => item.id === turn.id ? { ...item, ...turn } : item) : [...current, turn]);
  }

  async function send(retry?: PendingSend) {
    const question = retry?.question ?? draft.trim();
    if (!question || !consent || busy || dictation.listening || dictation.starting || action.current) return;
    const request = retry ?? { requestId: randomUUID(), question, conversationId, modelId: selected?.id };
    action.current = true;
    setError('');
    setSending(true);
    setShowModels(false);
    setShowQuota(false);
    setPending(request);
    setPartial('');
    if (!retry) setDraft('');
    Keyboard.dismiss();
    let finished = false;
    function event(data: SendEvent) {
      if (data.quota) applyQuota(data.quota);
      if (data.conversation) {
        setConversation(data.conversation);
        void AsyncStorage.setItem(conversationKey, data.conversation.id).catch(() => {});
      }
      if (data.turn) {
        applyTurn(data.turn);
        if (data.turn.status !== 'PENDING') {
          finished = true;
          setPartial('');
        }
      }
      if (data.text) setPartial(current => current + data.text);
      if (data.error) setError(data.error);
      requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: false }));
    }
    try {
      const response = await apiFetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, consent: consentVersion }),
      }, true);
      if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
        const { turn } = await readJson<{ turn: Turn }>(response);
        await loadConversation(turn.conversationId);
        finished = true;
      } else {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Antwort konnte nicht geöffnet werden.');
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) if (line) event(JSON.parse(line) as SendEvent);
        }
        if (!finished) throw new Error('Die Verbindung wurde unterbrochen. Lade die Antwort erneut.');
      }
      setPending(undefined);
    } catch (cause) {
      if (cause instanceof CoachHttpError && ((cause.status >= 400 && cause.status < 500) || cause.status === 503)) {
        setPending(undefined);
        setDraft(question);
      }
      if (cause instanceof CoachHttpError && cause.status === 422) selectModel('');
      showError(cause);
    }
    finally { setPartial(''); action.current = false; setSending(false); }
  }

  function startNew() {
    setConversation(undefined);
    setTurns([]);
    setDraft('');
    setPending(undefined);
    setOlderTurns(false);
    setHistory(false);
    void AsyncStorage.removeItem(conversationKey).catch(() => {});
  }

  function removeConversation(item: Conversation) {
    Alert.alert('Gespräch löschen?', item.title, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => void perform(async () => {
        await readJson(await apiFetch(url({ conversation: item.id }), { method: 'DELETE' }));
        if (item.id === conversationId) startNew();
        await loadConversations();
      }) },
    ]);
  }

  function openPlan(id: string, week = 1) {
    return perform(async () => {
      const data = await readJson<{ plan: Plan; week: Week | null }>(await apiFetch(url({ plan: id, week: String(week) }), { cache: 'no-store' }));
      setPlanView({ ...data, number: week });
    });
  }

  function confirmPlan(turn: Turn) {
    return perform(async () => {
      const result = await readJson<{ planId: string; status: string; quota?: CoachQuota }>(await apiFetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', turnId: turn.id }),
      }));
      if (result.quota) applyQuota(result.quota);
      applyTurn({ ...turn, plan: { id: result.planId, title: turn.proposal?.title ?? 'Trainingsplan', status: result.status, totalWeeks: 0 } });
    });
  }

  const sendDisabled = busy || sending || dictation.listening || dictation.starting || Boolean(pending) || !draft.trim()
    || remaining?.messages === 0 || Boolean(selected?.premium && remaining?.premiumMessages === 0);

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 44}>
    <View style={styles.toolbar}>
      {planView ? <Button label="Zum Chat" onPress={() => setPlanView(undefined)} /> : <>
        <Button label={history ? 'Zum Chat' : 'Gespräche'} disabled={busy || sending} onPress={() => {
          if (history) setHistory(false);
          else void perform(async () => { await loadConversations(); setHistory(true); });
        }} />
        <Button label="Neues Gespräch" onPress={startNew} disabled={busy || sending} />
      </>}
    </View>
    {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    {planView ? <ScrollView contentContainerStyle={styles.list}>
      <Text style={styles.heading}>{planView.plan.title}</Text>
      <Text style={styles.muted}>Woche {planView.number} von {planView.plan.totalWeeks}</Text>
      {planView.week ? <>
        <Text style={styles.text}>{planView.week.focusTitle ?? planView.week.phase} · {planView.week.targetDistance} km geplant</Text>
        {planView.week.workouts.map((workout, index) => <View style={styles.card} key={workout.scheduledDate + index}>
          <Text style={styles.muted}>{formatDate(workout.scheduledDate)} · {workout.sportType}</Text>
          <Text style={styles.subheading}>{workout.title}</Text>
          <Text style={styles.text}>{workout.description}</Text>
          <Text style={styles.muted}>{[
            workout.targetDistance && `${workout.targetDistance} km`, workout.targetDurationMinutes && `${workout.targetDurationMinutes} min`,
            workout.targetPaceMin && `${[workout.targetPaceMin, workout.targetPaceMax].filter(Boolean).join('–')} min/km`, workout.targetHrZone && `Pulszone ${workout.targetHrZone}`,
          ].filter(Boolean).join(' · ')}</Text>
        </View>)}
      </> : <Text style={styles.muted}>Für diese Woche sind keine Einheiten verfügbar.</Text>}
      <View style={styles.row}>
        <Button label="Vorherige Woche" disabled={busy || planView.number <= 1} onPress={() => void openPlan(planView.plan.id, planView.number - 1)} />
        <Button label="Nächste Woche" disabled={busy || planView.number >= planView.plan.totalWeeks} onPress={() => void openPlan(planView.plan.id, planView.number + 1)} />
      </View>
    </ScrollView> : history ? <ScrollView contentContainerStyle={styles.list}>
      {conversations.length ? conversations.map(item => <View key={item.id} style={styles.card}>
        <Text style={styles.subheading}>{item.title}</Text>
        <View style={styles.row}>
          <Button label="Öffnen" disabled={busy} onPress={() => void perform(async () => {
            await loadConversation(item.id); setDraft(''); setPending(undefined); setHistory(false);
          })} />
          <Button label="Löschen" disabled={busy} onPress={() => removeConversation(item)} />
        </View>
      </View>) : <Text style={styles.muted}>Noch keine gespeicherten Gespräche.</Text>}
      {olderConversations ? <Button label="Weitere Gespräche" disabled={busy} onPress={() => void perform(async () => {
        await loadConversations(conversations.at(-1)?.id);
      })} /> : null}
    </ScrollView> : <>
      <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
        scrollEventThrottle={32} onScrollBeginDrag={() => { loadHistoryOnScroll.current = true; }}
        onScroll={({ nativeEvent }) => {
          if (!loadHistoryOnScroll.current || nativeEvent.contentOffset.y > 20 || !olderTurns ||
            !conversationId || !turns[0] || busy || sending) return;
          loadHistoryOnScroll.current = false;
          void perform(() => loadConversation(conversationId, turns[0].id));
        }}
        maintainVisibleContentPosition={{ minIndexForVisible: 1 }} onContentSizeChange={() => {
          if (scrollToLatest.current) {
            scrollToLatest.current = false;
            scroll.current?.scrollToEnd({ animated: false });
          }
        }}>
        {olderTurns && conversationId ? <Button label="Ältere Nachrichten laden" disabled={busy || sending} onPress={() => void perform(() => loadConversation(conversationId, turns[0]?.id))} /> : null}
        {!turns.length && !busy && consent ? <>
          <Text style={styles.heading}>Smart Coach</Text>
          <Text style={styles.muted}>Sprich über dein Training oder erstelle einen Trainingsplan.</Text>
          {examples.map(example => <Button key={example} label={example} onPress={() => setDraft(example)} />)}
        </> : null}
        {turns.map(turn => <View key={turn.id} style={styles.exchange}>
          <Text style={styles.question}>{turn.question}</Text>
          {turn.answer ? <Text selectable style={styles.answer}>{turn.answer}</Text> : null}
          {turn.status === 'PENDING' && !sending ? <Text style={styles.muted}>Der Coach antwortet …</Text> : null}
          {turn.status === 'FAILED' ? <Button label="Nachricht erneut schreiben" disabled={busy || sending} onPress={() => setDraft(turn.question)} /> : null}
          {turn.sources?.map(source => /^https:\/\/www\.strava\.com\/activities\/\d+$/.test(source.url) ? (
            <Button key={source.url} label={source.label + ' · Strava'} onPress={() => void Linking.openURL(source.url).catch(showError)} />
          ) : null)}
          {turn.proposal ? <View style={styles.card}>
            <Text style={styles.subheading}>{turn.proposal.title}</Text>
            <Text style={styles.text}>{turn.proposal.weeklyAvailability} Einheiten pro Woche · {turn.proposal.targetDate ? formatDate(turn.proposal.targetDate) : '10 Wochen'}</Text>
            {turn.proposal.targetDistance ? <Text style={styles.muted}>Zieldistanz: {turn.proposal.targetDistance} km</Text> : null}
            {turn.proposal.targetTimeSeconds ? <Text style={styles.muted}>Zielzeit: {Math.floor(turn.proposal.targetTimeSeconds / 60)} min {turn.proposal.targetTimeSeconds % 60} s</Text> : null}
            <Text style={styles.muted}>Langer Lauf: {weekdays[turn.proposal.preferredLongRunDay ?? -1] ?? 'Flexibel'} · Sonntagslauf: {(turn.proposal.includeSundayRun ?? true) ? 'Ja' : 'Nein'}</Text>
            {turn.proposal.goalDescription ? <Text style={styles.muted}>{turn.proposal.goalDescription}</Text> : null}
            {turn.plan ? <>
              <Text style={styles.muted}>{planStatuses[turn.plan.status] ?? turn.plan.status}</Text>
              {!['QUEUED', 'PROCESSING', 'FAILED'].includes(turn.plan.status) ? <Button label="Plan öffnen" primary disabled={busy} onPress={() => void openPlan(turn.plan!.id)} /> : null}
            </> : <>
              <Text style={styles.muted}>Sobald der neue Plan fertig ist, pausiert dein bisher aktiver Plan.</Text>
              <Button label="Plan erstellen" primary disabled={busy || sending || remaining?.plans === 0} onPress={() => void confirmPlan(turn)} />
            </>}
          </View> : null}
        </View>)}
        {partial ? <Text style={styles.answer}>{partial}</Text> : null}
        {sending && !partial ? <Text style={styles.muted}>Der Coach antwortet …</Text> : null}
        {pending && !sending ? <Button label="Antwort erneut laden" disabled={busy} onPress={() => void send(pending)} /> : null}
        {waiting && !sending && conversationId ? <Button label="Status aktualisieren" disabled={busy} onPress={() => void perform(async () => { await refreshPending(); })} /> : null}
        {error && !conversationId && !pending && !sending ? <Button label="Erneut laden" disabled={busy} onPress={() => { setError(''); void initialize(); }} /> : null}
      </ScrollView>
      {!consent && !busy ? <View style={[styles.card, styles.consentCard]}>
        <Text style={styles.subheading}>KI-Coach aktivieren</Text>
        <Text style={styles.text}>Für Antworten verarbeitet xAI deine Chatnachrichten und je nach Frage relevante Ausschnitte aus deinem Trainingsprofil, deinen Strava-Aktivitäten, freigegebenen Health-Daten, persönlichen Arena-Ergebnissen und Trainingsplänen. Gespräche werden in deinem DorfDüsen-Konto gespeichert und können gelöscht werden.</Text>
        <Button label="Zustimmen und Chat nutzen" primary onPress={() => void perform(async () => {
          await AsyncStorage.setItem(consentKey, consentVersion); setConsent(true);
        })} />
      </View> : null}
      {consent ? <View style={styles.composerArea}>
        {showQuota && remaining ? <View style={styles.quotaDetails}>
          <Text style={styles.subheading}>Heute noch frei</Text>
          {remaining.messages !== undefined ? <Text style={styles.text}>{remaining.messages} von {COACH_CHAT_DAILY_LIMIT} Nachrichten</Text> : null}
          {remaining.premiumMessages !== undefined ? <Text style={styles.text}>{remaining.premiumMessages} davon mit teureren Modellen</Text> : null}
          {remaining.plans !== undefined ? <Text style={styles.text}>{remaining.plans} Trainingspläne</Text> : null}
          <Text style={styles.muted}>Wird um Mitternacht zurückgesetzt.</Text>
        </View> : null}
        {showModels ? <ScrollView style={styles.modelList} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          {settings?.models.map(model => {
            const active = model.id === activeModel?.id;
            return <Pressable key={model.id} accessibilityRole="button" accessibilityState={{ selected: active }}
              style={styles.modelOption} onPress={() => selectModel(model.id === standard?.id ? '' : model.id)}>
              <Text style={[styles.modelLabel, active && styles.accent]}>{model.label}</Text>
              {active ? <Svg width={16} height={16} viewBox="0 0 24 24" accessible={false}>
                <Path d="m5 12 4 4L19 6" stroke="#fc945f" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg> : null}
            </Pressable>;
          })}
        </ScrollView> : null}
        {dictation.message ? <Text accessibilityLiveRegion="polite" style={styles.muted}>{dictation.message}</Text> : null}
        {dictation.needsSettings ? <Button label="Einstellungen öffnen" onPress={() => void dictation.openSettings()} /> : null}
        {dictation.canDownload ? <Button label="Deutsch herunterladen" onPress={() => void dictation.download()} /> : null}
        <TextInput accessibilityLabel="Nachricht an den Coach" value={joinDictation(draft, dictation.interim)} onChangeText={setDraft}
          editable={!dictation.listening} maxLength={3000} multiline placeholder="Deine Nachricht" placeholderTextColor="#a1a1aa" onFocus={() => setComposerFocused(true)} onBlur={() => setComposerFocused(false)}
          style={[styles.input, composerFocused && styles.inputFocused]} />
        <View style={styles.composerActions}>
          <View style={styles.leftActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="KI-Modell auswählen"
              accessibilityValue={{ text: activeModel?.label ?? 'Modell' }}
              accessibilityState={{ expanded: showModels, disabled: !activeModel || sending || Boolean(pending) }}
              disabled={!activeModel || sending || Boolean(pending)} onPress={() => { setShowQuota(false); setShowModels(open => !open); }}
              style={[styles.button, styles.modelTrigger, (sending || pending) && styles.disabled]}>
              <Text style={styles.modelTriggerLabel} numberOfLines={1}>{activeModel?.label ?? 'Modell'}</Text>
              <Svg width={12} height={12} viewBox="0 0 24 24" accessible={false}>
                <Path d={showModels ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} stroke="#fafafa" strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </Pressable>
            {remaining?.messages !== undefined ? <QuotaRing left={remaining.messages} label={coachQuotaLabel(remaining)}
              expanded={showQuota} onPress={() => { setShowModels(false); setShowQuota(open => !open); }} /> : null}
          </View>
          <View style={styles.messageActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={dictation.listening ? 'Diktat beenden' : 'Nachricht diktieren'}
              accessibilityState={{ selected: dictation.listening, disabled: dictation.starting || busy || sending }}
              disabled={dictation.starting || busy || sending} onPress={() => void dictation.toggle()}
              style={[styles.button, styles.iconButton, dictation.listening && styles.primary, (dictation.starting || busy || sending) && styles.disabled]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false}>
                {dictation.listening ? <Rect x={6} y={6} width={12} height={12} rx={1} fill="#171717" /> : <>
                  <Rect x={9} y={2} width={6} height={13} rx={3} stroke="#fafafa" strokeWidth={2} fill="none" />
                  <Path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3" stroke="#fafafa" strokeWidth={2} strokeLinecap="round" fill="none" />
                </>}
              </Svg>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Nachricht senden"
              accessibilityState={{ disabled: sendDisabled }} disabled={sendDisabled} onPress={() => void send()}
              style={[styles.button, styles.iconButton, styles.primary, sendDisabled && styles.disabled]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false}>
                <Path d="M12 19V5m-7 7 7-7 7 7" stroke="#171717" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </Pressable>
          </View>
        </View>
      </View> : null}
    </>}
  </KeyboardAvoidingView>;
}

function QuotaRing({ left, label, expanded, onPress }: { left: number; label: string; expanded: boolean; onPress: () => void }) {
  const share = Math.max(0, Math.min(1, left / COACH_CHAT_DAILY_LIMIT));
  const color = left === 0 ? '#f87171' : share <= 0.25 ? '#facc15' : '#fc945f';
  const radius = 14;
  const length = 2 * Math.PI * radius;
  return <Pressable accessibilityRole="button" accessibilityLabel="Tageskontingent anzeigen" accessibilityHint={label}
    accessibilityState={{ expanded }} hitSlop={4} onPress={onPress} style={styles.quotaRing}>
    <Svg width={34} height={34} viewBox="0 0 34 34" accessible={false}>
      <Circle cx={17} cy={17} r={radius} stroke="#3f3f46" strokeWidth={3} fill="none" />
      {share > 0 ? <Circle cx={17} cy={17} r={radius} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round"
        strokeDasharray={`${length * share} ${length}`} transform="rotate(-90 17 17)" /> : null}
    </Svg>
    <Text style={[styles.quotaCount, { color }]}>{left}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09090b' },
  scroll: { flex: 1 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, borderBottomColor: '#27272a', borderBottomWidth: 1 },
  list: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exchange: { gap: 8 },
  heading: { color: '#fafafa', fontSize: 26, fontWeight: '800' },
  subheading: { color: '#fafafa', fontSize: 17, fontWeight: '700' },
  text: { color: '#fafafa', fontSize: 15, lineHeight: 22 },
  muted: { color: '#a1a1aa', fontSize: 14, lineHeight: 20 },
  accent: { color: '#fc945f', fontSize: 15, fontWeight: '600' },
  button: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#27272a' },
  primary: { backgroundColor: '#fc945f' },
  primaryText: { color: '#171717', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  card: { backgroundColor: '#18181b', borderColor: '#3f3f46', borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
  question: { alignSelf: 'flex-end', maxWidth: '92%', backgroundColor: '#42281e', color: '#fafafa', borderRadius: 14, padding: 12, fontSize: 16, lineHeight: 23 },
  answer: { backgroundColor: '#18181b', color: '#fafafa', borderRadius: 14, padding: 12, fontSize: 16, lineHeight: 24 },
  consentCard: { margin: 12 },
  composerArea: { padding: 12, gap: 6, borderTopColor: '#27272a', borderTopWidth: 1 },
  composerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  leftActions: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  messageActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modelTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 44, flexShrink: 1, paddingHorizontal: 8 },
  modelTriggerLabel: { color: '#fafafa', fontSize: 14, flexShrink: 1 },
  modelList: { maxHeight: 200, borderRadius: 10, borderWidth: 1, borderColor: '#3f3f46', backgroundColor: '#18181b' },
  modelOption: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8 },
  modelLabel: { flex: 1, color: '#fafafa', fontSize: 15 },
  quotaRing: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  quotaCount: { position: 'absolute', fontSize: 11, fontWeight: '700' },
  quotaDetails: { gap: 4, borderRadius: 10, borderWidth: 1, borderColor: '#3f3f46', backgroundColor: '#18181b', padding: 12 },
  iconButton: { width: 44, alignItems: 'center', paddingHorizontal: 0 },
  inputFocused: { borderColor: '#fc945f' },
  input: { minHeight: 52, maxHeight: 120, textAlignVertical: 'top', color: '#fafafa', backgroundColor: '#27272a', borderWidth: 1, borderColor: '#71717a', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  error: { color: '#fca5a5', paddingHorizontal: 16, paddingVertical: 8 },
});
