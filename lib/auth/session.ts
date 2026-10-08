import { cookies } from 'next/headers';
import { db } from '@/lib/db';

const SESSION_COOKIE_NAME = 'dorfduesen_session';
const DEFAULT_SECRET = 'dorfduesen-super-secret-strava-auth-fallback-key-2026';

function getSecretKey(): string {
  return process.env.SESSION_SECRET || DEFAULT_SECRET;
}

// Simple base64url encode/decode
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

async function signString(input: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(input));
  return Buffer.from(signature)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export interface SessionPayload {
  userId: string;
  stravaAthleteId: string;
  exp: number; // Unix timestamp
}

export async function createSessionToken(payload: Omit<SessionPayload, 'exp'>, expiresInDays = 30): Promise<string> {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = await signString(encodedPayload, getSecretKey());
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return null;

    const expectedSig = await signString(encodedPayload, getSecretKey());
    if (signature !== expectedSig) return null;

    const payload: SessionPayload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const session = await verifySessionToken(token);
    if (!session) return null;

    const user = await db.user.findUnique({
      where: { id: session.userId },
      include: {
        account: {
          select: {
            scope: true,
            expiresAt: true,
            updatedAt: true,
          },
        },
        _count: {
          select: {
            activities: true,
          },
        },
      },
    });

    return user;
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
}
