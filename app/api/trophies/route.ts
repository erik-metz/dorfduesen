import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { evaluateUserBadges } from '@/lib/arena/badge-engine';
import { BADGE_DEFINITIONS, ensureBadgesSeeded } from '@/lib/arena/badge-definitions';
import { getWeekKey } from '@/lib/arena/stats';

export async function GET(request: Request) {
  await connection();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get('userId') || user.id;
  const isReadOnly = targetUserId !== user.id;

  try {
    await ensureBadgesSeeded(db);

    // Only auto-evaluate when athlete looks at their own cabinet
    if (!isReadOnly) {
      await evaluateUserBadges(user.id);
    }

    // 1. Fetch user unlocked badges
    const userBadges = await db.userBadge.findMany({
      where: { userId: targetUserId },
      include: { badge: true },
    });

    const userBadgeMap = new Map(userBadges.map((ub) => [ub.badge.code, ub]));

    // 2. Fetch weekly title holders (current and historical)
    const weeklyHolders = await db.weeklyTitleHolder.findMany({
      where: { userId: targetUserId },
      orderBy: { weekKey: 'desc' },
    });

    // 3. Fetch monthly title holders
    const monthlyHolders = await db.monthlyTitleHolder.findMany({
      where: { userId: targetUserId },
      orderBy: { monthKey: 'desc' },
    });

    // 4. Current week leaders for live indicator
    const currentWeekKey = getWeekKey(new Date());
    const currentWeekHolders = await db.weeklyTitleHolder.findMany({
      where: { weekKey: currentWeekKey },
    });
    const currentWeekLeaderTitles = new Set(
      currentWeekHolders.filter((h) => h.userId === targetUserId).map((h) => h.titleId)
    );

    // 5. Build full badge list
    const badges = BADGE_DEFINITIONS.map((def) => {
      const userBadge = userBadgeMap.get(def.code);
      const isUnlocked = !!userBadge;

      return {
        ...def,
        isUnlocked,
        level: userBadge?.level || 0,
        unlockedAt: userBadge?.unlockedAt?.toISOString() || null,
        metadata: userBadge?.metadata || null,
      };
    });

    // Stats summary
    const unlockedCount = userBadges.length;
    const totalCount = BADGE_DEFINITIONS.length;
    const weeklyCrownsCount = userBadges
      .filter((ub) => ub.badge.category === 'WEEKLY')
      .reduce((sum, ub) => sum + ub.level, 0);
    const monthlyAwardsCount = userBadges
      .filter((ub) => ub.badge.category === 'MONTHLY')
      .reduce((sum, ub) => sum + ub.level, 0);

    return NextResponse.json({
      success: true,
      badges,
      stats: {
        unlockedCount,
        totalCount,
        weeklyCrownsCount,
        monthlyAwardsCount,
      },
      weeklyHolders,
      monthlyHolders,
      currentWeekLeaderTitles: Array.from(currentWeekLeaderTitles),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fehler beim Laden der Trophäen';
    console.error('Fehler beim Abrufen des Trophäenschranks:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
