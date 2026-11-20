export const COACH_CHAT_DAILY_LIMIT = 40;
export const COACH_PREMIUM_DAILY_LIMIT = 10;
export const COACH_CONSENT_VERSION = 'coach-xai-v1';

export type CoachQuota = {
  messages: number;
  premiumMessages: number;
  plans: number;
  resetsAt: string;
};

export type CoachSettings = {
  models: { id: string; label: string; premium: boolean; newest: boolean }[];
  defaultModelId: string | null;
  quota: CoachQuota;
};

export function isCoachSettings(value: unknown): value is CoachSettings {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<CoachSettings>;
  return Array.isArray(data.models)
    && (data.defaultModelId === null || typeof data.defaultModelId === 'string')
    && typeof data.quota?.messages === 'number'
    && typeof data.quota.premiumMessages === 'number'
    && typeof data.quota.plans === 'number'
    && typeof data.quota.resetsAt === 'string';
}

export function joinDictation(draft: string, transcript: string) {
  const text = transcript.trim();
  return text ? [draft.trimEnd(), text].filter(Boolean).join(' ').slice(0, 3000) : draft;
}
