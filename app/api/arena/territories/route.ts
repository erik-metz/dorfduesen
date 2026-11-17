import { isTerritoryBudgetError, TERRITORY_RETRY_SECONDS } from '@/lib/territory/budget';
import { connection, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getTerritoryData } from '@/lib/territory/service';

// Bound public reads independently of the long-running Inngest/coach handlers.
export const maxDuration = 10;

export async function GET() {
  await connection();
  const headers = { 'Cache-Control': 'private, no-store' };
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden, um die Revierkarte zu sehen.' }, { status: 401, headers });
  try {
    return NextResponse.json(await getTerritoryData(user.id), { headers });
  } catch (error) {
    if (isTerritoryBudgetError(error)) return NextResponse.json({ error: 'Die Revierkarte ist gerade nicht verfügbar. Bitte später erneut versuchen.' }, {
      status: 503, headers: { ...headers, 'Retry-After': String(TERRITORY_RETRY_SECONDS) },
    });
    console.error('Revier konnte nicht geladen werden:', error);
    return NextResponse.json({ error: 'Revier konnte nicht geladen werden.' }, { status: 500, headers });
  }
}
