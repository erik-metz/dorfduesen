import { COACH_MODEL_REFRESH_INTERVAL, isCoachSettings, type CoachQuota, type CoachSettings } from './contracts';

type CacheEntry = { attemptedAt: number; settings?: CoachSettings };
type Storage = {
  read: (key: string) => string | null | Promise<string | null>;
  write: (key: string, value: string) => void | Promise<void>;
};

const entries = new Map<string, CacheEntry>();
const requests = new Map<string, Promise<CacheEntry>>();

async function readEntry(key: string, storage: Storage) {
  const memory = entries.get(key);
  try {
    const raw = await storage.read(key);
    const saved = raw ? JSON.parse(raw) as CacheEntry : undefined;
    if (saved && Number.isFinite(saved.attemptedAt) && saved.attemptedAt >= (memory?.attemptedAt ?? 0)) {
      return { attemptedAt: saved.attemptedAt, settings: isCoachSettings(saved.settings) ? saved.settings : undefined };
    }
  } catch { /* A blocked or unavailable store still permits the in-memory cache. */ }
  return memory ?? { attemptedAt: 0 };
}

export async function refreshDailyCoachSettings(
  key: string,
  storage: Storage,
  fetchSettings: (signal: AbortSignal) => Promise<unknown>,
  show: (settings: CoachSettings, fresh: boolean) => void,
  exclusive?: (key: string, refresh: () => Promise<number>) => Promise<number>,
) {
  const cached = await readEntry(key, storage);
  if (cached.settings) show(cached.settings, false);

  async function refresh() {
    const saved = exclusive ? await readEntry(key, storage) : cached;
    if (saved.settings && (saved.attemptedAt !== cached.attemptedAt || !cached.settings)) show(saved.settings, false);
    let request = requests.get(key);
    const latest = entries.get(key);
    const previous = latest && latest.attemptedAt > saved.attemptedAt ? latest : saved;
    if (!request && Date.now() - previous.attemptedAt < COACH_MODEL_REFRESH_INTERVAL) {
      return previous.attemptedAt + COACH_MODEL_REFRESH_INTERVAL;
    }

    if (!request) {
      const attempt = { ...previous, attemptedAt: Date.now() };
      entries.set(key, attempt);
      const save = async (entry: CacheEntry) => {
        try { await storage.write(key, JSON.stringify(entry)); } catch { /* The attempt is tracked in memory. */ }
      };
      request = (async () => {
        await save(attempt);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        try {
          const settings = await fetchSettings(controller.signal);
          if (!isCoachSettings(settings) || !settings.defaultModelId || !settings.models.length) return attempt;
          const updated = { attemptedAt: Date.now(), settings };
          entries.set(key, updated);
          await save(updated);
          return updated;
        } catch {
          return attempt;
        } finally {
          clearTimeout(timeout);
        }
      })();
      requests.set(key, request);
      void request.then(() => requests.delete(key));
    }

    const result = await request;
    if (result.settings && result.settings !== previous.settings) show(result.settings, true);
    return result.attemptedAt + COACH_MODEL_REFRESH_INTERVAL;
  }

  return exclusive ? exclusive(key, refresh) : refresh();
}

export function currentCoachQuota(quota?: Partial<CoachQuota>) {
  return quota?.resetsAt && Date.parse(quota.resetsAt) > Date.now() ? quota : undefined;
}

export function mergeCoachQuota(previous: Partial<CoachQuota> | undefined, next: Partial<CoachQuota>) {
  return { ...(currentCoachQuota(previous) && (!next.resetsAt || next.resetsAt === previous?.resetsAt) ? previous : {}), ...next };
}

export function coachQuotaLabel(quota?: Partial<CoachQuota>) {
  if (!quota) return '';
  const parts = [
    quota.messages === undefined ? '' : `${quota.messages} Nachrichten`,
    quota.premiumMessages === undefined ? '' : `${quota.premiumMessages} mit teureren Modellen`,
    quota.plans === undefined ? '' : `${quota.plans} Pläne`,
  ].filter(Boolean);
  return parts.length ? `${parts.join(' · ')} übrig bis Mitternacht` : '';
}
