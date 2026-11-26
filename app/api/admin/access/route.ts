import { NextResponse, connection } from 'next/server';
import { getAccessOverview } from '@/lib/admin/access';
import { adminHeaders, requireAdmin } from '@/lib/admin/route-auth';

export async function GET() {
  await connection();
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  return NextResponse.json(await getAccessOverview(), { headers: adminHeaders });
}
