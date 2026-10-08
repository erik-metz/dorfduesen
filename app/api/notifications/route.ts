import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { checkWeeklyTitleChanges } from '@/lib/arena/title-tracker';

export async function GET() {
  await connection();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({
      authenticated: false,
      notifications: [],
      unreadCount: 0,
    });
  }

  const notifications = await db.notification.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 30,
  });

  const unreadCount = await db.notification.count({
    where: {
      userId: user.id,
      isRead: false,
    },
  });

  return NextResponse.json({
    authenticated: true,
    notifications,
    unreadCount,
  });
}

export async function PATCH(request: Request) {
  await connection();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { notificationId, all } = body;

    if (all) {
      await db.notification.updateMany({
        where: {
          userId: user.id,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });
      return NextResponse.json({ success: true, markedAll: true });
    }

    if (notificationId) {
      await db.notification.updateMany({
        where: {
          id: notificationId,
          userId: user.id,
        },
        data: {
          isRead: true,
        },
      });
      return NextResponse.json({ success: true, markedId: notificationId });
    }

    return NextResponse.json({ error: 'Keine ID oder all angegeben' }, { status: 400 });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Benachrichtigung:', error);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 });
  }
}

/**
 * Optional endpoint to manually recheck weekly title overtakes
 */
export async function POST() {
  await connection();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const results = await checkWeeklyTitleChanges();
    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Fehler beim Prüfen der Titel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
