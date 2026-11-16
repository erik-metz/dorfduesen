// Run from the repository root:
// node --env-file=.env scripts/backfill-territories.mjs [--apply]
// Includes existing runs from the current UTC quarter; dry run by default.
import { PrismaClient } from '@prisma/client';
import { Inngest } from 'inngest';

const apply = process.argv.includes('--apply');
const db = new PrismaClient();
try {
  const now = new Date();
  const quarterStart = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
  const settings = await db.territorySettings.findUniqueOrThrow({ where: { id: 'revier' } });
  const where = { sportType: { in: ['Run', 'TrailRun'] }, startDate: { gte: quarterStart, lte: now }, stravaId: { not: { startsWith: 'health:' } } };
  const [runs, withRoute] = await Promise.all([
    db.activity.count({ where }),
    db.activity.count({ where: { ...where, summaryPolyline: { not: null, notIn: [''] } } }),
  ]);
  console.log(JSON.stringify({ apply, previousStart: settings.enabledAt.toISOString(), quarterStart: quarterStart.toISOString(), runs, withRoute }));
  if (apply) {
    if (!process.env.INNGEST_EVENT_KEY) throw new Error('INNGEST_EVENT_KEY fehlt; es wurden keine Daten geändert.');
    await db.$transaction(async tx => {
      // Only extend eligibility. Never move an existing earlier activation forwards.
      await tx.territorySettings.updateMany({ where: { id: 'revier', enabledAt: { gt: quarterStart } }, data: { enabledAt: quarterStart } });
      // A previous same-day OLD result must not suppress a newly eligible run.
      await tx.territoryClaim.updateMany({
        where: { reason: 'OLD', activity: where }, data: { checkedAt: new Date(0) },
      });
    });
    const inngest = new Inngest({ id: 'dorfduesen-coach', eventKey: process.env.INNGEST_EVENT_KEY, isDev: false });
    const sent = await inngest.send({ name: 'territory/reconcile', data: {} });
    console.log(JSON.stringify({ queued: true, eventIds: sent.ids, runs }));
  }
} catch (error) {
  // SDK transport errors can include request URLs; redact configured credentials.
  let message = error instanceof Error ? error.message : 'Backfill fehlgeschlagen';
  for (const key of ['DATABASE_URL', 'INNGEST_EVENT_KEY']) {
    if (process.env[key]) message = message.replaceAll(process.env[key], '[redacted]');
  }
  console.error(message);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
