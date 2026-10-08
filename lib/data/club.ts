import clubDataRaw from '@/data/club-data.json';
import { ClubData } from '@/types/club';

export async function getClubData(): Promise<ClubData> {
  // In the future, this function can connect directly to Strava & Instagram API endpoints
  // e.g.:
  // const stravaStats = await fetchStravaStats();
  // const instagramMedia = await fetchInstagramFeed();
  
  return clubDataRaw as ClubData;
}
