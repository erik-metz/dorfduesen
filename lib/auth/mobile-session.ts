import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';

const AUTH_CODE_TTL_SECONDS = 120;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export function hashMobileSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function getMobileAppRedirectUri(): string {
  const redirectUri = process.env.MOBILE_APP_REDIRECT_URI || 'dorfduesen://auth/callback';
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new Error('MOBILE_APP_REDIRECT_URI must be a valid absolute URL.');
  }

  const isAppScheme = parsed.protocol === 'dorfduesen:' && parsed.hostname === 'auth' && parsed.pathname === '/callback';
  const isHttpsLink = parsed.protocol === 'https:' && Boolean(parsed.hostname);
  if ((!isAppScheme && !isHttpsLink) || parsed.search || parsed.hash) {
    throw new Error('MOBILE_APP_REDIRECT_URI must be the configured app callback URL.');
  }
  return parsed.toString();
}

export async function createMobileAuthCode(userId: string, codeChallenge: string): Promise<string> {
  const code = randomBytes(32).toString('base64url');
  await db.mobileAuthCode.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await db.mobileAuthCode.create({
    data: {
      userId,
      codeHash: hashMobileSecret(code),
      codeChallenge,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000),
    },
  });
  return code;
}

export async function exchangeMobileAuthCode(code: string, verifier: string): Promise<{ token: string; expiresAt: Date } | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(code) || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return null;

  const authCode = await db.mobileAuthCode.findUnique({ where: { codeHash: hashMobileSecret(code) } });
  const now = new Date();
  if (!authCode || authCode.expiresAt <= now) return null;

  const challenge = createHash('sha256').update(verifier).digest('base64url');
  if (challenge !== authCode.codeChallenge) return null;

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const created = await db.$transaction(async (tx) => {
    const consumed = await tx.mobileAuthCode.deleteMany({
      where: { id: authCode.id, expiresAt: { gt: now } },
    });
    if (consumed.count !== 1) return false;
    await tx.mobileSession.deleteMany({ where: { expiresAt: { lte: now } } });
    await tx.mobileSession.create({ data: { userId: authCode.userId, tokenHash: hashMobileSecret(token), expiresAt } });
    return true;
  });

  return created ? { token, expiresAt } : null;
}

export async function getMobileSessionUserId(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = await db.mobileSession.findUnique({
    where: { tokenHash: hashMobileSecret(token) },
    select: { userId: true, expiresAt: true, revokedAt: true },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  return session.userId;
}

export async function revokeMobileSession(token: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  await db.mobileSession.updateMany({
    where: { tokenHash: hashMobileSecret(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function makeMobileRedirectUrl(redirectUri: string, params: Record<string, string>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
