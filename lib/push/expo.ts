import { db } from '@/lib/db';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN_PATTERN = /^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]{10,100}\]$/;

export function isExpoPushToken(token: unknown): token is string {
  return typeof token === 'string' && EXPO_TOKEN_PATTERN.test(token);
}

type PushMessage = { title: string; body: string; data?: Record<string, unknown> };

/**
 * Send one push message to every registered device of the given users through the Expo push service.
 * Bounded to a single request with a timeout; tokens that Expo reports as unregistered are removed.
 */
export async function sendPushToUsers(userIds: string[], message: PushMessage): Promise<void> {
  if (userIds.length === 0) return;
  const tokens = await db.pushToken.findMany({ where: { userId: { in: userIds } }, select: { token: true }, take: 50 });
  if (tokens.length === 0) return;

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens.map(({ token }) => ({
        to: token,
        title: message.title,
        body: message.body,
        data: message.data ?? {},
        sound: 'default',
        priority: 'high',
      }))),
    });
    if (!response.ok) {
      console.error('Expo push request failed with status:', response.status);
      return;
    }
    const result = await response.json().catch(() => null) as { data?: Array<{ status?: string; message?: string; details?: { error?: string } }> } | null;
    const stale: string[] = [];
    result?.data?.forEach((ticket, index) => {
      if (ticket.status !== 'error') return;
      if (ticket.details?.error === 'DeviceNotRegistered') stale.push(tokens[index].token);
      else console.error('Expo push ticket error:', ticket.details?.error ?? ticket.message);
    });
    if (stale.length) await db.pushToken.deleteMany({ where: { token: { in: stale } } });
  } catch (error) {
    console.error('Expo push could not be sent:', error);
  }
}
