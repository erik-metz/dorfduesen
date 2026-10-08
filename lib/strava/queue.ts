import { inngest } from '@/lib/inngest/client';

export function queueDashboardSync(userId: string) {
  return inngest.send({
    id: `dashboard-sync:${userId}:${Math.floor(Date.now() / 60000)}`,
    name: 'strava/sync.requested', data: { userId },
  });
}
