import { db } from '@/lib/db';
import { COACH_CHAT_DAILY_LIMIT, COACH_PREMIUM_DAILY_LIMIT, type CoachQuota } from '@/apps/mobile/src/coach/contracts';
import { DAILY_GENERATION_LIMIT, generationDay } from '@/lib/training/plan-requests';
import { dayKey } from '@/lib/time';

export async function readCoachQuota(userId: string): Promise<CoachQuota> {
  const day = dayKey();
  const range = generationDay(day);
  const [chat, plans] = await Promise.all([
    db.coachChatQuota.findUnique({ where: { userId } }),
    db.planGenerationAttempt.count({ where: { userId, createdAt: range } }),
  ]);
  return {
    messages: Math.max(0, COACH_CHAT_DAILY_LIMIT - (chat?.day === day ? chat.count : 0)),
    premiumMessages: Math.max(0, COACH_PREMIUM_DAILY_LIMIT - (chat?.day === day ? chat.premiumCount : 0)),
    plans: Math.max(0, DAILY_GENERATION_LIMIT - plans),
    resetsAt: range.lt.toISOString(),
  };
}
