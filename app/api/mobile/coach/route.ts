import { getCurrentUser } from '@/lib/auth/session';
import { coachGet, coachPost, coachDelete } from '@/lib/coach/chat-route';

export const maxDuration = 50;

async function mobileUser(request: Request) {
  if (!/^Bearer\s+[A-Za-z0-9_-]{43}$/i.test(request.headers.get('authorization') ?? '')) return null;
  return getCurrentUser();
}

export async function GET(request: Request) {
  return coachGet(request, (await mobileUser(request))?.id);
}

export async function POST(request: Request) {
  return coachPost(request, (await mobileUser(request))?.id);
}

export async function DELETE(request: Request) {
  return coachDelete(request, (await mobileUser(request))?.id);
}
