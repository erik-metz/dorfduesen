import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserTrophies } from '@/lib/data/trophies';

export async function GET(request: Request) {
  await connection();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get('userId') || user.id;

  try {
    return NextResponse.json(await getUserTrophies(targetUserId));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fehler beim Laden der Trophäen';
    console.error('Fehler beim Abrufen des Trophäenschranks:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
