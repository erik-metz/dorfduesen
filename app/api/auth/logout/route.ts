import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth/session';

export async function POST(request: Request) {
  await clearSessionCookie();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return NextResponse.redirect(`${appUrl}/?logout=success`);
}

export async function GET(request: Request) {
  await clearSessionCookie();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return NextResponse.redirect(`${appUrl}/?logout=success`);
}
