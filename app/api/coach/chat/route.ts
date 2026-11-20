import { getCurrentUser } from '@/lib/auth/session';
import { coachGet, coachPost, coachDelete } from '@/lib/coach/chat-route';

export const maxDuration = 50;

export async function GET(request: Request) {
  return coachGet(request, (await getCurrentUser())?.id);
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    return Response.json({ error: 'Ungültige Anfrage.' }, { status: 415 });
  }
  return coachPost(request, (await getCurrentUser())?.id);
}

export async function DELETE(request: Request) {
  return coachDelete(request, (await getCurrentUser())?.id);
}
