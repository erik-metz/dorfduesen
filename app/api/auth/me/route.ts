import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { sanitizeAvatarUrl } from '@/lib/utils/avatar';

export async function GET() {
  await connection();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      stravaAthleteId: user.stravaAthleteId,
      firstname: user.firstname,
      lastname: user.lastname,
      username: user.username,
      profile: sanitizeAvatarUrl(user.profile),
      city: user.city,
      country: user.country,
      activityCount: user._count.activities,
      scope: user.account?.scope,
      lastSync: user.account?.updatedAt,
    },
  });
}
