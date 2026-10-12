// Run with: node --env-file=.env scripts/audit-trophies.mjs [--apply]
// Dry run by default; never logs names, tokens or activity contents.
import { PrismaClient } from '@prisma/client';
import { loadTs } from '../tests/load-ts.mjs';
const db = new PrismaClient();
const apply = process.argv.includes('--apply');
const changes = [];
try {
  const auditDb = {
    activity: db.activity, badge: db.badge,
    userBadge: {
      findMany: args => db.userBadge.findMany(args),
      create: async args => { changes.push({ action: 'create', badge: args.data.badgeId }); if (apply) return db.userBadge.create(args); },
      update: async args => { if (apply) return db.userBadge.update(args); },
      deleteMany: async args => { changes.push({ action: 'remove', badge: args.where.id }); if (apply) return db.userBadge.deleteMany(args); },
    },
    notification: {
      create: async () => {}, // Repairs must not generate a burst of celebration notifications.
      deleteMany: async args => { if (apply) return db.notification.deleteMany(args); },
    },
  };
  const definitions = loadTs('lib/arena/badge-definitions.ts').BADGE_DEFINITIONS;
  const { evaluateUserBadges } = loadTs('lib/arena/badge-engine.ts', {
    '@/lib/db': { db: auditDb }, './badge-definitions': { BADGE_DEFINITIONS: definitions, ensureBadgesSeeded: async () => {} },
  });
  const users = await db.user.findMany({ select: { id: true } });
  for (const user of users) await evaluateUserBadges(user.id);
  const { getWeeklyChampions } = loadTs('lib/arena/stats.ts', { '@/lib/db': { db }, 'next/cache': { cacheLife() {}, cacheTag() {} } });
  const { berlinMidnight } = loadTs('lib/time.ts');
  const holders = await db.weeklyTitleHolder.findMany({ where: { isFinalized: true } });
  let invalidWeekly = 0;
  for (const holder of holders) {
    const champions = await getWeeklyChampions(berlinMidnight(holder.weekKey));
    const champ = champions.find(c => c.id === holder.titleId.split(':')[0]);
    const winners = champ?.recipients ?? (champ?.winner ? [champ.winner] : []);
    if (!winners.some(w => w.userId === holder.userId && Math.abs(w.value - holder.value) < 0.000001)) invalidWeekly++;
  }
  const periodBadges = await db.userBadge.findMany({ where: { badge: { code: { startsWith: 'WEEKLY_' } } }, include: { badge: true } });
  const titleCodes = { run_distance:'WEEKLY_RUN_DISTANCE', ride_distance:'WEEKLY_RIDE_DISTANCE', stayed_active:'WEEKLY_STAYED_ACTIVE', routine:'WEEKLY_ROUTINE', goal:'WEEKLY_GOAL', progress:'WEEKLY_PROGRESS', elevation:'WEEKLY_ELEVATION', distance:'WEEKLY_DISTANCE', time:'WEEKLY_TIME', heartrate:'WEEKLY_HEARTRATE', early_bird:'WEEKLY_EARLYBIRD', consistency:'WEEKLY_CONSISTENCY' };
  let invalidWeeklyBadges = 0;
  for (const badge of periodBadges) {
    const matches = holders.filter(h => h.userId === badge.userId && titleCodes[h.titleId.split(':')[0]] === badge.badge.code);
    const history = badge.metadata?.history;
    if (badge.level !== matches.length || !Array.isArray(history) || history.length !== matches.length || history.some(h => !matches.some(m => m.weekKey === h.weekKey))) invalidWeeklyBadges++;
  }
  console.log(JSON.stringify({ apply, users: users.length, changes, weeklyHolders: holders.length, invalidWeekly, weeklyBadges: periodBadges.length, invalidWeeklyBadges, monthlyHolders: await db.monthlyTitleHolder.count() }));
  if (invalidWeekly || invalidWeeklyBadges) process.exitCode = 1;
} finally { await db.$disconnect(); }
