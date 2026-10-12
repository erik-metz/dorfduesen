import type { ClubPost } from '@/types/club';

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  children?: { data: InstagramMedia[]; paging?: { next?: string } };
}

function safeUrl(value?: string): string | undefined {
  if (!value) return;
  try { return new URL(value).protocol === 'https:' ? value : undefined; } catch { return; }
}

export function normalizeMedia(items: InstagramMedia[]): ClubPost[] {
  return items.flatMap(item => {
    const media = (item.media_type === 'CAROUSEL_ALBUM' ? item.children?.data ?? [] : [item])
      .flatMap(child => {
        const url = safeUrl(child.media_url);
        if (!url || !['IMAGE', 'VIDEO'].includes(child.media_type)) return [];
        return [{ type: child.media_type as 'IMAGE' | 'VIDEO', url, poster: safeUrl(child.thumbnail_url) }];
      });
    if (!media.length) return [];
    return [{ id: item.id, caption: item.caption ?? '', likeCount: null, commentCount: null,
      takenAt: item.timestamp && Number.isFinite(Date.parse(item.timestamp)) ? Date.parse(item.timestamp) : null,
      permalink: safeUrl(item.permalink), images: media.filter(m => m.type === 'IMAGE').map(m => m.url), media }];
  }).sort((a, b) => (b.takenAt ?? 0) - (a.takenAt ?? 0));
}
