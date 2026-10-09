import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { weekRange } from '@/lib/time';

const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: Request) {
  await connection();
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Ungültiger Ursprung.' }, { status: 403, headers });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401, headers });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Ungültige Eingabe.' }, { status: 400, headers }); }
  if (!Number.isInteger(body?.activeDays) || body.activeDays < 1 || body.activeDays > 7) {
    return NextResponse.json({ error: 'Wähle zwischen einem und sieben Tagen.' }, { status: 400, headers });
  }
  try {
    const goal = await db.$transaction(async tx => {
      const next = weekRange(weekRange().end);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('weekly-goal'), hashtext(${user.id}))::text`;
      // Check again after acquiring the lock: never edit a week that has started.
      if (new Date() >= next.start) throw new Error('Die Woche hat bereits begonnen. Bitte neu laden.');
      return tx.weeklyGoal.upsert({
        where: { userId_weekKey: { userId: user.id, weekKey: next.key } },
        create: { userId: user.id, weekKey: next.key, activeDays: body.activeDays },
        update: { activeDays: body.activeDays },
      });
    });
    return NextResponse.json({ goal }, { headers });
  } catch (error) {
    console.error('Wochenziel konnte nicht gespeichert werden:', error);
    return NextResponse.json({ error: 'Speichern fehlgeschlagen. Bitte erneut versuchen.' }, { status: 500, headers });
  }
}
