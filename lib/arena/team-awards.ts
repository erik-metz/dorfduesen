import { db } from '@/lib/db';
import { monthRange } from '@/lib/time';
import { cacheTags, invalidateCacheTags } from '@/lib/cache-tags';
import { TEAM_BADGE_PREFIX, TEAM_TARGET_KM, teamContributions, teamMonthLabel } from './team-challenge';

/** One permanent trophy per contributor and calendar month, including later contributors. */
export async function awardMonthlyTeamChallenge(reference = new Date(), now = new Date()) {
  const range = monthRange(reference);
  const awarded = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('team-mission'), hashtext(${range.key}))::text`;
    const activities = await tx.activity.findMany({
      where: { startDate: { gte: range.start, lt: range.end, lte: now }, movingTime: { gt: 0 } },
      select: { userId: true, distance: true, manualDistance: true, extractedDistance: true, movingTime: true, startDate: true },
    });
    const contributions = teamContributions(activities, reference, now);
    const totalKm = [...contributions.values()].reduce((sum, meters) => sum + meters, 0) / 1000;
    if (totalKm < TEAM_TARGET_KM) return [];

    const monthLabel = teamMonthLabel(range.key);
    const definition = {
      code: `${TEAM_BADGE_PREFIX}${range.key}`,
      name: `Gemeinsam 1.000 km · ${monthLabel}`,
      description: `Im ${monthLabel} gemeinsam mindestens 1.000 km geschafft – du warst mit eigenen Kilometern dabei!`,
      icon: '🏆', category: 'MONTHLY', rarity: 'EPIC',
    };
    const badge = await tx.badge.upsert({ where: { code: definition.code }, create: definition, update: {} });
    const existing = await tx.userBadge.findMany({ where: { badgeId: badge.id }, select: { userId: true } });
    const recipients = new Set(existing.map(item => item.userId));
    const results: Array<{ userId: string; code: string; name: string; icon: string; isNew: true; level: number }> = [];
    for (const [userId, meters] of contributions) {
      if (recipients.has(userId)) continue;
      const contributionKm = meters / 1000;
      const metadata = { monthKey: range.key, monthLabel, ruleVersion: 1, targetKm: TEAM_TARGET_KM,
        contributionKm, teamKm: totalKm, contributorCount: contributions.size, awardedAt: now.toISOString(),
        history: [{ monthKey: range.key, formattedValue: `${contributionKm.toLocaleString('de-DE', { maximumFractionDigits: 2 })} km beigetragen` }] };
      await tx.userBadge.create({ data: { userId, badgeId: badge.id, metadata } });
      await tx.notification.create({ data: {
        userId, type: 'BADGE_UNLOCKED', title: `🏆 Gemeinsam geschafft! · ${monthLabel}`,
        message: `Die Dorfdüsen haben das Monatsziel von 1.000 km geknackt! Du hast ${contributionKm.toLocaleString('de-DE', { maximumFractionDigits: 2 })} km beigetragen. Deine Trophäe „${definition.name}“ steht in deiner Sammlung.`,
        link: '/dashboard?tab=trophies', metadata: { ...metadata, code: definition.code, icon: definition.icon },
      } });
      results.push({ userId, code: definition.code, name: definition.name, icon: definition.icon, isNew: true, level: 1 });
    }
    return results;
  }, { timeout: 30000 });
  if (awarded.length) invalidateCacheTags(cacheTags.trophies, cacheTags.notifications, cacheTags.arena);
  return awarded;
}

/** Also catch imports arriving just after a month boundary. Older months stay untouched. */
export async function evaluateMonthlyTeamChallenges(now = new Date()) {
  const current = await awardMonthlyTeamChallenge(now, now);
  const previous = await awardMonthlyTeamChallenge(new Date(monthRange(now).start.getTime() - 1), now);
  return [...current, ...previous];
}
