import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getMembers } from '@/lib/data/members';
import { sanitizeAvatarUrl } from '@/lib/utils/avatar';

const headers = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET() {
  await connection();
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401, headers });

  const members = await getMembers();
  return NextResponse.json({ members: members.map(member => ({
    id: member.id,
    name: [member.firstname, member.lastname].filter(Boolean).join(' ') || member.username || 'Dorfdüse',
    profile: sanitizeAvatarUrl(member.profile),
    city: member.city,
  })) }, { headers });
}
