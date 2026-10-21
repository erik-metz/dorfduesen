import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth/session';
import { revokeMobileSession } from '@/lib/auth/mobile-session';

export async function POST(request: Request) {
  const bearerToken = request.headers.get('authorization')?.match(/^Bearer\s+([A-Za-z0-9_-]{43})$/i)?.[1];
  if (bearerToken) {
    await revokeMobileSession(bearerToken);
    return NextResponse.json({ loggedOut: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  await clearSessionCookie();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return NextResponse.redirect(`${appUrl}/?logout=success`);
}

export async function GET(request: Request) {
  await clearSessionCookie();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return NextResponse.redirect(`${appUrl}/?logout=success`);
}
