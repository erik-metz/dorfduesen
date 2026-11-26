import { NextResponse } from 'next/server';
import { removeMember } from '@/lib/admin/access';
import { adminHeaders, requireAdmin } from '@/lib/admin/route-auth';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const result = await removeMember(id, auth.user.id);
  if (result === 'removed') return NextResponse.json({ ok: true }, { headers: adminHeaders });
  const errors = {
    not_found: [404, 'Mitglied nicht gefunden.'],
    self: [400, 'Du kannst dich nicht selbst entfernen.'],
    admin: [400, 'Admins können nicht entfernt werden.'],
  } as const;
  const [status, error] = errors[result];
  return NextResponse.json({ error }, { status, headers: adminHeaders });
}
