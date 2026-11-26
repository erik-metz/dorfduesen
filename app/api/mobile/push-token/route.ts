import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { isExpoPushToken } from '@/lib/push/expo';

const headers = { 'Cache-Control': 'private, no-store, max-age=0' };

async function readToken(request: Request) {
  const body = await request.json().catch(() => null) as { token?: unknown; platform?: unknown } | null;
  return {
    token: isExpoPushToken(body?.token) ? body.token : null,
    platform: body?.platform === 'ios' || body?.platform === 'android' ? body.platform : null,
  };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401, headers });
  const { token, platform } = await readToken(request);
  if (!token || !platform) return NextResponse.json({ error: 'Ungültiger Push-Token.' }, { status: 400, headers });
  await db.pushToken.upsert({
    where: { token },
    update: { userId: user.id, platform },
    create: { token, platform, userId: user.id },
  });
  return NextResponse.json({ registered: true }, { headers });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401, headers });
  const { token } = await readToken(request);
  if (token) await db.pushToken.deleteMany({ where: { token, userId: user.id } });
  return NextResponse.json({ removed: true }, { headers });
}
