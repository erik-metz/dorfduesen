import { NextResponse } from 'next/server';
import { approveAccessRequest, rejectAccessRequest } from '@/lib/admin/access';
import { adminHeaders, requireAdmin } from '@/lib/admin/route-auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  if (body?.action !== 'approve' && body?.action !== 'reject') {
    return NextResponse.json({ error: 'Aktion muss "approve" oder "reject" sein.' }, { status: 400, headers: adminHeaders });
  }
  const done = body.action === 'approve' ? await approveAccessRequest(id) : await rejectAccessRequest(id);
  if (!done) return NextResponse.json({ error: 'Anfrage nicht gefunden oder bereits entschieden.' }, { status: 404, headers: adminHeaders });
  return NextResponse.json({ ok: true }, { headers: adminHeaders });
}
