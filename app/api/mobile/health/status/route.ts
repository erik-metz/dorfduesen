import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getHealthStatus } from '@/lib/data/health-status';

export async function GET() {
  await connection();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });

  return NextResponse.json(await getHealthStatus(user.id), { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
