import { weekRange, monthRange } from '@/lib/time';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getWeeklyChampions } from './stats';
import { ensureBadgesSeeded } from './badge-definitions';

const TITLE_TO_BADGE_CODE: Record<string, string> = {
  elevation: 'WEEKLY_ELEVATION',
  distance: 'WEEKLY_DISTANCE',
  time: 'WEEKLY_TIME',
  heartrate: 'WEEKLY_HEARTRATE',
  early_bird: 'WEEKLY_EARLYBIRD',
  consistency: 'WEEKLY_CONSISTENCY',
};

/**
 * Finalizes weekly champions for the previous week (Monday 00:00 - Sunday 23:59).
 * Marks WeeklyTitleHolder as finalized and awards/levels up permanent trophies in UserBadge.
 */
export async function finalizeWeeklyAwards(refDate: Date = new Date()) {
  await ensureBadgesSeeded(db);

  const previous = weekRange(new Date(weekRange(refDate).start.getTime() - 1));
  const startOfPrevWeek = previous.start;
  const prevWeekKey = previous.key;

  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('arena'), hashtext(${prevWeekKey}))::text`;
    // 2. Fetch weekly champions for the previous week
    const champions = await getWeeklyChampions(startOfPrevWeek);
    const finalizedResults = [];

    for (const champ of champions) {
      if (!champ.winner || champ.winner.value <= 0) continue;

      const winner = champ.winner;
      const badgeCode = TITLE_TO_BADGE_CODE[champ.id];

      const finalized = await tx.weeklyTitleHolder.findUnique({
        where: { weekKey_titleId: { weekKey: prevWeekKey, titleId: champ.id } },
      });
      if (finalized?.isFinalized) continue;
      // 3. Persist finalized weekly title holder
      await tx.weeklyTitleHolder.upsert({
        where: {
          weekKey_titleId: {
            weekKey: prevWeekKey,
            titleId: champ.id,
          },
        },
        create: {
          weekKey: prevWeekKey,
          titleId: champ.id,
          userId: winner.userId,
          value: winner.value,
          isFinalized: true,
        },
        update: {
          userId: winner.userId,
          value: winner.value,
          isFinalized: true,
        },
      });

      if (!badgeCode) continue;

      const badgeDb = await tx.badge.findUnique({ where: { code: badgeCode } });
      if (!badgeDb) continue;

      // 4. Update or create permanent trophy badge in UserBadge
      const existingBadge = await tx.userBadge.findUnique({
        where: {
          userId_badgeId: {
            userId: winner.userId,
            badgeId: badgeDb.id,
          },
        },
      });

      const meta = (existingBadge?.metadata as Record<string, unknown>) || { history: [] };
      const history: Array<{ weekKey: string; value: number; formattedValue: string }> = Array.isArray(meta.history)
        ? meta.history
        : [];

      const alreadyAwardedForWeek = history.some((h) => h.weekKey === prevWeekKey);

      if (!alreadyAwardedForWeek) {
        history.push({
          weekKey: prevWeekKey,
          value: winner.value,
          formattedValue: winner.formattedValue,
        });

        const newLevel = existingBadge ? existingBadge.level + 1 : 1;

        if (!existingBadge) {
          await tx.userBadge.create({
            data: {
              userId: winner.userId,
              badgeId: badgeDb.id,
              level: 1,
              metadata: { history: history as unknown as Prisma.InputJsonValue },
            },
          });
        } else {
          await tx.userBadge.update({
            where: { id: existingBadge.id },
            data: {
              level: newLevel,
              metadata: { history: history as unknown as Prisma.InputJsonValue },
            },
          });
        }

        // 5. Send Celebration Notification
        await tx.notification.create({
          data: {
            userId: winner.userId,
            type: 'WEEKLY_CHAMPION',
            title: `🏆 Wochensieg: ${champ.title}!`,
            message: `Starke Leistung! Du hast die Kalenderwoche (${prevWeekKey}) als Champion bei "${champ.title}" mit ${winner.formattedValue} abgeschlossen! Deine Trophäe steht im Profil bereit.`,
            link: '/dashboard?tab=trophies',
            metadata: {
              weekKey: prevWeekKey,
              titleId: champ.id,
              championTitle: champ.title,
              icon: champ.icon,
              value: winner.value,
              formattedValue: winner.formattedValue,
              level: newLevel,
            },
          },
        });

        finalizedResults.push({
          weekKey: prevWeekKey,
          titleId: champ.id,
          champion: champ.title,
          winnerId: winner.userId,
          winnerName: winner.name,
          value: winner.formattedValue,
          newLevel,
        });
      }
    }

    return finalizedResults;
  }, { timeout: 30000 });
}

/**
 * Finalizes monthly awards for the previous calendar month.
 * Awards Month King, Century Club, Double Century, and consistency trophies.
 */
export async function finalizeMonthlyAwards(refDate: Date = new Date()) {
  await ensureBadgesSeeded(db);

  const previous = monthRange(new Date(monthRange(refDate).start.getTime() - 1));
  const monthKey = previous.key;
  const startOfMonth = previous.start;
  const endOfMonth = previous.end;
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('arena'), hashtext(${monthKey}))::text`;
      const finalized = await tx.monthlyTitleHolder.findUnique({ where: { monthKey_titleId: { monthKey, titleId: 'month_king' } } });
      if (finalized?.isFinalized) return [];
    // Fetch activities in that month
    const activities = await tx.activity.findMany({
      where: {
        startDate: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
      select: {
        userId: true,
        distance: true,
        sportType: true,
        user: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            username: true,
          },
        },
      },
    });

    if (activities.length === 0) return [];

    // Group by user
    const userDistance = new Map<string, { totalDistance: number; name: string }>();
    for (const a of activities) {
      const cur = userDistance.get(a.userId) || {
        totalDistance: 0,
        name: [a.user.firstname, a.user.lastname].filter(Boolean).join(' ') || a.user.username || 'Athlet',
      };
      cur.totalDistance += a.distance;
      userDistance.set(a.userId, cur);
    }

    // Find Month King (highest total distance)
    let bestUser: { userId: string; distance: number; name: string } | null = null;
    for (const [uid, data] of userDistance.entries()) {
      if (!bestUser || data.totalDistance > bestUser.distance) {
        bestUser = { userId: uid, distance: data.totalDistance, name: data.name };
      }
    }

    const results = [];

    if (bestUser && bestUser.distance > 0) {
      const bestKm = bestUser.distance / 1000;

      await tx.monthlyTitleHolder.upsert({
        where: {
          monthKey_titleId: {
            monthKey,
            titleId: 'month_king',
          },
        },
        create: {
          monthKey,
          titleId: 'month_king',
          userId: bestUser.userId,
          value: bestKm,
          isFinalized: true,
        },
        update: {
          userId: bestUser.userId,
          value: bestKm,
          isFinalized: true,
        },
      });

      const monthKingBadge = await tx.badge.findUnique({ where: { code: 'MONTH_KING' } });
      if (monthKingBadge) {
        const existing = await tx.userBadge.findUnique({
          where: { userId_badgeId: { userId: bestUser.userId, badgeId: monthKingBadge.id } },
        });

        const meta = (existing?.metadata as Record<string, unknown>) || { history: [] };
        const history = Array.isArray(meta.history) ? (meta.history as Array<Record<string, unknown>>) : [];

        if (!history.some((h) => h.monthKey === monthKey)) {
          history.push({ monthKey, distanceKm: bestKm.toFixed(1) });
          const newLevel = existing ? existing.level + 1 : 1;

          if (!existing) {
            await tx.userBadge.create({
              data: {
                userId: bestUser.userId,
                badgeId: monthKingBadge.id,
                level: 1,
                metadata: { history: history as unknown as Prisma.InputJsonValue },
              },
            });
          } else {
            await tx.userBadge.update({
              where: { id: existing.id },
              data: { level: newLevel, metadata: { history: history as unknown as Prisma.InputJsonValue } },
            });
          }

          await tx.notification.create({
            data: {
              userId: bestUser.userId,
              type: 'MONTHLY_CHAMPION',
              title: `🏆 Monats-König: ${monthKey}!`,
              message: `Fantastisch! Du hast im Monat ${monthKey} mit ${bestKm.toFixed(1)} km den gesamten Club angeführt und dir die Monatskrone gesichert!`,
              link: '/dashboard?tab=trophies',
              metadata: { monthKey, distanceKm: bestKm.toFixed(1), level: newLevel },
            },
          });

          results.push({
            award: 'MONTH_KING',
            winnerId: bestUser.userId,
            winnerName: bestUser.name,
            monthKey,
            distanceKm: bestKm.toFixed(1),
          });
        }
      }
    }

    return results;
  }, { timeout: 30000 });
}
