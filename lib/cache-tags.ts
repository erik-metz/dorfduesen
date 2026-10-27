import { revalidateTag } from 'next/cache';

export const cacheTags = {
  arena: 'arena',
  members: 'members',
  instagramFeed: 'instagram-feed',
  notifications: 'notifications',
  trophies: 'trophies',
  userActivities: (userId: string) => `user:${userId}:activities`,
  userProfile: (userId: string) => `user:${userId}:profile`,
  userHealth: (userId: string) => `user:${userId}:health`,
  userGoals: (userId: string) => `user:${userId}:goals`,
  userTrophies: (userId: string) => `user:${userId}:trophies`,
  userNotifications: (userId: string) => `user:${userId}:notifications`,
  userPlans: (userId: string) => `user:${userId}:plans`,
} as const;

/** Immediately expire data after a write so the next API read sees the mutation. */
export function invalidateCacheTags(...tags: string[]) {
  for (const tag of new Set(tags)) revalidateTag(tag, { expire: 0 });
}
