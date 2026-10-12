import { normalizeMedia, type InstagramMedia } from './media';

interface PublicNode {
  id?: string;
  shortcode?: string;
  __typename?: string;
  is_video?: boolean;
  display_url?: string;
  video_url?: string;
  taken_at_timestamp?: number;
  edge_media_to_caption?: { edges?: { node?: { text?: string } }[] };
  edge_sidecar_to_children?: { edges?: { node?: PublicNode }[] };
}

function convert(node: PublicNode): InstagramMedia {
  const children = node.edge_sidecar_to_children?.edges;
  return {
    id: node.id ?? node.shortcode ?? '',
    media_type: children ? 'CAROUSEL_ALBUM' : node.is_video ? 'VIDEO' : 'IMAGE',
    media_url: node.is_video ? node.video_url : node.display_url,
    thumbnail_url: node.display_url,
    caption: node.edge_media_to_caption?.edges?.[0]?.node?.text,
    permalink: node.shortcode ? `https://www.instagram.com/p/${encodeURIComponent(node.shortcode)}/` : undefined,
    timestamp: typeof node.taken_at_timestamp === 'number' && Number.isFinite(node.taken_at_timestamp)
      ? new Date(node.taken_at_timestamp * 1000).toISOString() : undefined,
    children: children ? { data: children.flatMap(edge => edge.node ? [convert(edge.node)] : []) } : undefined,
  };
}

export function parsePublicProfile(payload: unknown) {
  const profile = payload as { data?: { user?: { is_private?: boolean;
    edge_owner_to_timeline_media?: { edges?: { node?: PublicNode }[] } } } };
  const user = profile?.data?.user;
  const edges = user?.edge_owner_to_timeline_media?.edges;
  if (user?.is_private || !Array.isArray(edges)) throw new Error('Instagram profile data unavailable');
  const posts = normalizeMedia(edges.slice(0, 12).flatMap(edge => edge.node ? [convert(edge.node)] : []));
  // Empty/login/challenge responses must never replace the last successful feed.
  if (!posts.length) throw new Error('Instagram returned no usable public posts');
  return posts;
}

export async function scrapeInstagramPosts() {
  const response = await fetch('https://www.instagram.com/api/v1/users/web_profile_info/?username=dorfduesen', {
    headers: { 'X-IG-App-ID': '936619743392459', 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Instagram public request failed (${response.status})`);
  return parsePublicProfile(await response.json());
}

// Daily scheduler, anchored to UTC epoch days: exactly every three days, including month boundaries.
export function isInstagramScrapeDay(now = Date.now()) {
  return Math.floor(now / 86400000) % 3 === 0;
}
