import { connection, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getTerritoryData } from '@/lib/territory/service';

export async function GET() {
  await connection();
  const headers = { 'Cache-Control': 'private, no-store' };
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden, um die Revierkarte zu sehen.' }, { status: 401, headers });
  try {
    return NextResponse.json(await getTerritoryData(user.id), { headers });
  } catch (error) {
    console.error('Revier konnte nicht geladen werden:', error);
    return NextResponse.json({ error: 'Revier konnte nicht geladen werden.' }, { status: 500, headers });
  }
}
