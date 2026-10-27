import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/lib/db';
import { cacheTags } from '@/lib/cache-tags';

export async function getUserNotifications(userId: string) {
  'use cache: remote';
  cacheLife({ stale: 5, revalidate: 10, expire: 30 });
  cacheTag(cacheTags.notifications, cacheTags.userNotifications(userId));

  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    db.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { notifications, unreadCount };
}

export async function getUnreadNotificationSummary(userId: string) {
  'use cache: remote';
  cacheLife({ stale: 5, revalidate: 10, expire: 30 });
  cacheTag(cacheTags.notifications, cacheTags.userNotifications(userId));
  const [latestUnread, unreadCount] = await Promise.all([
    db.notification.findFirst({ where: { userId, isRead: false }, orderBy: { createdAt: 'desc' }, select: { title: true } }),
    db.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { latestUnread, unreadCount };
}
