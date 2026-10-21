import { NextResponse } from 'next/server';
import { exchangeMobileAuthCode } from '@/lib/auth/mobile-session';

const headers = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400, headers });
  }

  const code = (body as { code?: unknown } | null)?.code;
  const verifier = (body as { verifier?: unknown } | null)?.verifier;
  if (typeof code !== 'string' || typeof verifier !== 'string') {
    return NextResponse.json({ error: 'Ungültiger Anmeldecode.' }, { status: 400, headers });
  }

  try {
    const session = await exchangeMobileAuthCode(code, verifier);
    if (!session) return NextResponse.json({ error: 'Anmeldecode ungültig oder abgelaufen.' }, { status: 401, headers });
    return NextResponse.json({ token: session.token, expiresAt: session.expiresAt.toISOString() }, { headers });
  } catch (error) {
    console.error('Mobile OAuth code exchange failed:', error);
    return NextResponse.json({ error: 'Anmeldung konnte nicht abgeschlossen werden.' }, { status: 500, headers });
  }
}
