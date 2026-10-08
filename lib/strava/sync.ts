import { db } from '@/lib/db';
import { getValidStravaToken } from './tokens';

export interface StravaRawActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  sport_type?: string;
  start_date: string;
  start_date_local: string;
  timezone?: string;
  average_speed?: number;
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  kudos_count?: number;
  comment_count?: number;
  achievement_count?: number;
  map?: {
    summary_polyline?: string;
  };
}

export async function syncUserActivities(userId: string, perPage = 30): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const accessToken = await getValidStravaToken(userId);

    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?page=1&per_page=${perPage}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Strava API Fehler: ${response.status} ${errorText}`);
    }

    const activities: StravaRawActivity[] = await response.json();

    let syncedCount = 0;

    for (const act of activities) {
      const stravaId = String(act.id);
      const sportType = act.sport_type || act.type || 'Workout';

      const record = await db.activity.upsert({
        where: { stravaId },
        update: {
          name: act.name,
          distance: act.distance,
          movingTime: act.moving_time,
          elapsedTime: act.elapsed_time,
          totalElevationGain: act.total_elevation_gain,
          sportType: sportType,
          startDate: new Date(act.start_date),
          startDateLocal: new Date(act.start_date_local),
          timezone: act.timezone || null,
          averageSpeed: act.average_speed ?? null,
          maxSpeed: act.max_speed ?? null,
          averageHeartrate: act.average_heartrate ?? null,
          maxHeartrate: act.max_heartrate ?? null,
          kudosCount: act.kudos_count ?? 0,
          commentCount: act.comment_count ?? 0,
          achievementCount: act.achievement_count ?? 0,
          summaryPolyline: act.map?.summary_polyline ?? null,
          syncedAt: new Date(),
        },
        create: {
          userId,
          stravaId,
          name: act.name,
          distance: act.distance,
          movingTime: act.moving_time,
          elapsedTime: act.elapsed_time,
          totalElevationGain: act.total_elevation_gain,
          sportType: sportType,
          startDate: new Date(act.start_date),
          startDateLocal: new Date(act.start_date_local),
          timezone: act.timezone || null,
          averageSpeed: act.average_speed ?? null,
          maxSpeed: act.max_speed ?? null,
          averageHeartrate: act.average_heartrate ?? null,
          maxHeartrate: act.max_heartrate ?? null,
          kudosCount: act.kudos_count ?? 0,
          commentCount: act.comment_count ?? 0,
          achievementCount: act.achievement_count ?? 0,
          summaryPolyline: act.map?.summary_polyline ?? null,
        },
      });

      // Dispatch event to Inngest for background coach evaluation
      try {
        const { inngest } = await import('@/lib/inngest/client');
        await inngest.send({
          name: 'strava/activity.synced',
          data: {
            activityId: record.id,
            userId,
          },
        });
      } catch {
        // Continue silently if Inngest is offline or during local development
      }

      syncedCount++;
    }

    // Erfolgreichen Log eintragen
    await db.syncLog.create({
      data: {
        userId,
        status: 'SUCCESS',
        itemsSynced: syncedCount,
      },
    });

    return { success: true, count: syncedCount };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unbekannter Synchronisationsfehler';
    console.error(`Fehler beim Synchronisieren von User ${userId}:`, error);

    await db.syncLog.create({
      data: {
        userId,
        status: 'ERROR',
        itemsSynced: 0,
        errorMessage: errorMsg,
      },
    });

    return { success: false, count: 0, error: errorMsg };
  }
}
