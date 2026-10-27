import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { cacheTags, invalidateCacheTags } from '@/lib/cache-tags';

export async function PATCH(request: Request, { params }: { params: Promise<{ stravaId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  const { stravaId } = await params;
  const body = await request.json().catch(() => null) as { distanceKm?: unknown } | null;
  const km = body?.distanceKm;
  if (typeof km !== 'number' || !Number.isFinite(km) || km < 0 || km > 1000) {
    return NextResponse.json({ error: 'Distanz muss zwischen 0 und 1000 km liegen.' }, { status: 400 });
  }
  const activity = await db.activity.findFirst({ where: { stravaId, userId: user.id }, select: { id: true } });
  if (!activity) return NextResponse.json({ error: 'Aktivität nicht gefunden.' }, { status: 404 });
  const updated = await db.activity.update({
    where: { id: activity.id }, data: { manualDistance: km === 0 ? null : km * 1000 },
    select: { manualDistance: true, extractedDistance: true, distance: true },
  });
  invalidateCacheTags(cacheTags.userActivities(user.id), cacheTags.arena);
  const { revalidatePath } = await import('next/cache');
  revalidatePath('/dashboard');
  return NextResponse.json({ distance: updated.manualDistance ?? updated.extractedDistance ?? updated.distance });
}
