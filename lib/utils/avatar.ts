/**
 * Validates and sanitizes Strava avatar URLs.
 * Strava returns 'avatar/athlete/large.png' or relative placeholders when a user has no uploaded picture.
 * Next.js fails if an invalid relative path is passed to <Image src={...} />.
 */
export function isValidAvatarUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) return false;
  if (trimmed.includes('avatar/athlete/')) return false;
  return true;
}

export function sanitizeAvatarUrl(url?: string | null): string | null {
  return isValidAvatarUrl(url) ? url!.trim() : null;
}
