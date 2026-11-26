import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { isAdmin } from '@/lib/admin/access';

export const adminHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

/** Resolve the signed-in admin, or the error response to return. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401, headers: adminHeaders }) } as const;
  if (!isAdmin(user)) return { error: NextResponse.json({ error: 'Nur für Club-Admins.' }, { status: 403, headers: adminHeaders }) } as const;
  return { user } as const;
}
