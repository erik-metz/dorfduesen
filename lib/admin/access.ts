import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { cacheTags, invalidateCacheTags } from '@/lib/cache-tags';
import { sendPushToUsers } from '@/lib/push/expo';
import { revokeStravaToken } from '@/lib/strava/revoke';
import { sanitizeAvatarUrl } from '@/lib/utils/avatar';

export type AccessProfile = {
  firstname: string | null;
  lastname: string | null;
  username: string | null;
  profile: string | null;
  city: string | null;
  country: string | null;
};

export function isAdmin(user: { role?: string | null } | null | undefined): boolean {
  return user?.role === 'ADMIN';
}

function displayName(profile: Pick<AccessProfile, 'firstname' | 'lastname' | 'username'>) {
  return [profile.firstname, profile.lastname].filter(Boolean).join(' ') || profile.username || 'Unbekannt';
}

/**
 * Record a sign-in attempt by a Strava athlete who is not a member yet.
 * Admins are notified only once, when the first request is created.
 */
export async function recordAccessAttempt(stravaAthleteId: string, profile: AccessProfile): Promise<{ status: 'PENDING' | 'REJECTED'; isNew: boolean }> {
  const update = { ...profile, attemptCount: { increment: 1 }, lastAttemptAt: new Date() };
  const existing = await db.accessRequest.findUnique({ where: { stravaAthleteId }, select: { id: true } });
  if (existing) {
    const updated = await db.accessRequest.update({ where: { id: existing.id }, data: update, select: { status: true } });
    return { status: updated.status === 'REJECTED' ? 'REJECTED' : 'PENDING', isNew: false };
  }
  try {
    await db.accessRequest.create({ data: { stravaAthleteId, ...profile } });
  } catch (error) {
    // A parallel callback for the same athlete created the row first.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const updated = await db.accessRequest.update({ where: { stravaAthleteId }, data: update, select: { status: true } });
      return { status: updated.status === 'REJECTED' ? 'REJECTED' : 'PENDING', isNew: false };
    }
    throw error;
  }
  return { status: 'PENDING', isNew: true };
}

export async function notifyAdminsAboutRequest(profile: AccessProfile): Promise<void> {
  const admins = await db.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
  if (admins.length === 0) return;
  const name = displayName(profile);
  const message = `${name} möchte sich bei Dorfdüsen anmelden. Bitte freigeben oder ablehnen.`;
  await db.notification.createMany({
    data: admins.map(({ id }) => ({ userId: id, type: 'ACCESS_REQUEST', title: 'Neue Zugangsanfrage', message, link: '/admin' })),
  });
  invalidateCacheTags(cacheTags.notifications);
  await sendPushToUsers(admins.map(({ id }) => id), {
    title: 'Neue Zugangsanfrage',
    body: message,
    data: { type: 'ACCESS_REQUEST', url: 'dorfduesen://admin' },
  });
}

export async function getAccessOverview() {
  const [requests, members] = await Promise.all([
    db.accessRequest.findMany({
      orderBy: { lastAttemptAt: 'desc' },
      take: 200,
      select: {
        id: true, stravaAthleteId: true, firstname: true, lastname: true, username: true, profile: true,
        city: true, status: true, attemptCount: true, lastAttemptAt: true, decidedAt: true, createdAt: true,
      },
    }),
    db.user.findMany({
      orderBy: [{ firstname: 'asc' }, { lastname: 'asc' }],
      select: {
        id: true, stravaAthleteId: true, firstname: true, lastname: true, username: true, profile: true,
        city: true, role: true, createdAt: true,
        account: { select: { updatedAt: true } },
        _count: { select: { activities: true } },
      },
    }),
  ]);
  const toRequest = (request: (typeof requests)[number]) => ({
    ...request,
    profile: sanitizeAvatarUrl(request.profile),
    lastAttemptAt: request.lastAttemptAt.toISOString(),
    decidedAt: request.decidedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
  });
  return {
    pending: requests.filter((request) => request.status === 'PENDING').map(toRequest),
    rejected: requests.filter((request) => request.status === 'REJECTED').map(toRequest),
    members: members.map((member) => ({
      id: member.id,
      stravaAthleteId: member.stravaAthleteId,
      firstname: member.firstname,
      lastname: member.lastname,
      username: member.username,
      profile: sanitizeAvatarUrl(member.profile),
      city: member.city,
      role: member.role,
      createdAt: member.createdAt.toISOString(),
      connected: Boolean(member.account),
      activityCount: member._count.activities,
    })),
  };
}

export type AccessOverview = Awaited<ReturnType<typeof getAccessOverview>>;

/** Turn a request into a member. Strava data is imported once the person signs in again. */
export async function approveAccessRequest(requestId: string): Promise<boolean> {
  const approved = await db.$transaction(async (tx) => {
    const request = await tx.accessRequest.findUnique({ where: { id: requestId } });
    if (!request) return false;
    const profile = {
      firstname: request.firstname, lastname: request.lastname, username: request.username,
      profile: request.profile, city: request.city, country: request.country,
    };
    await tx.user.upsert({
      where: { stravaAthleteId: request.stravaAthleteId },
      update: {},
      create: { stravaAthleteId: request.stravaAthleteId, ...profile },
    });
    await tx.accessRequest.delete({ where: { id: request.id } });
    return true;
  });
  if (approved) invalidateCacheTags(cacheTags.arena, cacheTags.members);
  return approved;
}

export async function rejectAccessRequest(requestId: string): Promise<boolean> {
  const result = await db.accessRequest.updateMany({
    where: { id: requestId, status: 'PENDING' },
    data: { status: 'REJECTED', decidedAt: new Date() },
  });
  return result.count === 1;
}

export type RemoveMemberResult = 'removed' | 'not_found' | 'self' | 'admin';

/**
 * Delete a member and all their data. The athlete is kept as a rejected request,
 * so a later sign-in attempt stays visible and can still be approved.
 */
export async function removeMember(memberId: string, actingUserId: string): Promise<RemoveMemberResult> {
  if (memberId === actingUserId) return 'self';
  const member = await db.user.findUnique({
    where: { id: memberId },
    select: {
      id: true, role: true, stravaAthleteId: true, firstname: true, lastname: true, username: true,
      profile: true, city: true, country: true, account: { select: { refreshToken: true } },
    },
  });
  if (!member) return 'not_found';
  if (member.role === 'ADMIN') return 'admin';

  await revokeStravaToken(member.account?.refreshToken);
  const profile = {
    firstname: member.firstname, lastname: member.lastname, username: member.username,
    profile: member.profile, city: member.city, country: member.country,
  };
  await db.$transaction([
    db.user.delete({ where: { id: member.id } }),
    db.accessRequest.upsert({
      where: { stravaAthleteId: member.stravaAthleteId },
      update: { ...profile, status: 'REJECTED', decidedAt: new Date() },
      create: { stravaAthleteId: member.stravaAthleteId, ...profile, status: 'REJECTED', attemptCount: 0, decidedAt: new Date() },
    }),
  ]);
  invalidateCacheTags(cacheTags.arena, cacheTags.members, cacheTags.userActivities(member.id));
  return 'removed';
}
