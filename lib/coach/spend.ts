import { db } from '@/lib/db';
import { dayKey } from '@/lib/time';

const ticksPerDollar = 10_000_000_000;

export class CoachBudgetError extends Error {
  constructor() {
    super('Das gemeinsame KI-Budget ist ausgeschöpft. Bitte versuche es später erneut.');
  }
}

export type ModelPrices = { input: number; output: number; longInput: number; longOutput: number };

export function estimateCoachCost(prices: ModelPrices, input: unknown, maxOutputTokens: number) {
  // Serialized UTF-8 bytes plus framing allowance conservatively cover text tokens
  // and tool definitions. Use the higher context tier when reserving.
  const inputTokens = Buffer.byteLength(JSON.stringify(input)) + 2048;
  return BigInt(inputTokens) * BigInt(Math.max(prices.input, prices.longInput))
    + BigInt(maxOutputTokens) * BigInt(Math.max(prices.output, prices.longOutput));
}

export async function reserveCoachSpend(ticks: bigint) {
  const usd = Number(process.env.XAI_COACH_MONTHLY_BUDGET_USD ?? '10');
  const configuredTicks = Math.floor(usd * ticksPerDollar);
  if (!Number.isSafeInteger(configuredTicks) || configuredTicks <= 0 || ticks > BigInt(configuredTicks)) {
    throw new CoachBudgetError();
  }
  const budget = BigInt(configuredTicks);
  const month = dayKey().slice(0, 7);
  const rows = await db.$executeRaw`
    INSERT INTO "CoachSpend" ("month", "ticks") VALUES (${month}, ${ticks})
    ON CONFLICT ("month") DO UPDATE SET "ticks" = "CoachSpend"."ticks" + EXCLUDED."ticks"
    WHERE "CoachSpend"."ticks" <= ${budget - ticks}
  `;
  if (rows !== 1) throw new CoachBudgetError();

  // Keep the reserve when the connection ends without a confirmed bill.
  return async (usage: unknown) => {
    const actual = (usage as { cost_in_usd_ticks?: unknown } | null)?.cost_in_usd_ticks;
    if (typeof actual !== 'number' || !Number.isSafeInteger(actual) || actual < 0) return;
    try {
      await db.coachSpend.update({ where: { month }, data: { ticks: { increment: BigInt(actual) - ticks } } });
    } catch {
      console.error('Coach budget settlement failed');
    }
  };
}
