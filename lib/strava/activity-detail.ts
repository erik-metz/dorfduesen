import { db } from '@/lib/db';
import { getValidStravaToken } from './tokens';

export interface ActivitySplit {
  split: number;
  distance: number;
  elapsed_time: number;
  moving_time: number;
  elevation_difference: number;
  average_speed: number;
  average_heartrate?: number | null;
  pace_zone?: number | null;
}

export interface ActivityBestEffort {
  id: number;
  name: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  pr_rank?: number | null;
}

export interface ActivitySegmentEffort {
  id: number;
  name: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  pr_rank?: number | null;
  kom_rank?: number | null;
  segment?: {
    id: number;
    name: string;
    city?: string;
    average_grade?: number;
    elevation_high?: number;
    elevation_low?: number;
  };
}

export interface ActivityStreamPoint {
  distance: number; // in meters
  time: number; // in seconds
  altitude?: number; // in meters
  heartrate?: number; // in bpm
  speed?: number; // in m/s
  cadence?: number; // rpm / spm
  watts?: number;
}

export interface ActivityDetailData {
  id: string;
  stravaId: string;
  name: string;
  description?: string | null;
  sportType: string;
  startDate: string;
  distance: number;
  movingTime: number;
  elapsedTime: number;
  totalElevationGain: number;
  elevHigh?: number | null;
  elevLow?: number | null;
  calories?: number | null;
  averageHeartrate?: number | null;
  maxHeartrate?: number | null;
  averageCadence?: number | null;
  averageSpeed?: number | null;
  maxSpeed?: number | null;
  averageTemp?: number | null;
  averageWatts?: number | null;
  maxWatts?: number | null;
  weightedAverageWatts?: number | null;
  kilojoules?: number | null;
  deviceWatts?: boolean;
  sufferScore?: number | null;
  deviceName?: string | null;
  gear?: {
    id: string;
    name: string;
    distance?: number;
  } | null;
  photos?: {
    count: number;
    primaryUrl?: string | null;
  } | null;
  splitsMetric?: ActivitySplit[];
  bestEfforts?: ActivityBestEffort[];
  segmentEfforts?: ActivitySegmentEffort[];
  summaryPolyline?: string | null;
  detailedPolyline?: string | null;
  streams?: ActivityStreamPoint[];
  cachedAt: string;
}

/**
 * Downsamples stream arrays down to targetCount points
 * using uniform sampling to keep frontend snappy and payload tiny.
 */
function downsampleStreams(
  streamsData: {
    time?: { data: number[] };
    distance?: { data: number[] };
    altitude?: { data: number[] };
    heartrate?: { data: number[] };
    velocity_smooth?: { data: number[] };
    cadence?: { data: number[] };
    watts?: { data: number[] };
  },
  targetCount = 200
): ActivityStreamPoint[] {
  const dist = streamsData.distance?.data;
  const time = streamsData.time?.data;
  if (!dist || dist.length === 0) return [];

  const totalPoints = dist.length;
  if (totalPoints <= targetCount) {
    return dist.map((d, i) => ({
      distance: d,
      time: time ? time[i] : i,
      altitude: streamsData.altitude?.data?.[i],
      heartrate: streamsData.heartrate?.data?.[i],
      speed: streamsData.velocity_smooth?.data?.[i],
      cadence: streamsData.cadence?.data?.[i],
      watts: streamsData.watts?.data?.[i],
    }));
  }

  const step = (totalPoints - 1) / (targetCount - 1);
  const result: ActivityStreamPoint[] = [];

  for (let i = 0; i < targetCount; i++) {
    const idx = Math.min(Math.round(i * step), totalPoints - 1);
    result.push({
      distance: dist[idx],
      time: time ? time[idx] : idx,
      altitude: streamsData.altitude?.data?.[idx],
      heartrate: streamsData.heartrate?.data?.[idx],
      speed: streamsData.velocity_smooth?.data?.[idx],
      cadence: streamsData.cadence?.data?.[idx],
      watts: streamsData.watts?.data?.[idx],
    });
  }

  return result;
}

export async function getActivityDetails(
  userId: string,
  stravaId: string
): Promise<ActivityDetailData> {
  // 1. Check if we already have the activity in DB
  const activity = await db.activity.findUnique({
    where: { stravaId },
  });

  if (!activity) {
    throw new Error(`Aktivität mit Strava ID ${stravaId} nicht in der Datenbank gefunden.`);
  }

  // 2. Return cached detail data if already stored
  if (activity.detailJson) {
    try {
      const cached = activity.detailJson as unknown as ActivityDetailData;
      if (cached && cached.stravaId === stravaId) {
        return cached;
      }
    } catch (e) {
      console.warn('Fehler beim Parsen der gecachten Detaildaten:', e);
    }
  }

  // 3. Fetch from Strava API with valid user token
  const token = await getValidStravaToken(userId);

  // A: Fetch Activity Details
  const detailUrl = `https://www.strava.com/api/v3/activities/${stravaId}`;
  const detailRes = await fetch(detailUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!detailRes.ok) {
    const errText = await detailRes.text();
    throw new Error(`Strava API Fehler (${detailRes.status}): ${errText}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = await detailRes.json();

  // B: Fetch Streams (Elevation, Heartrate, Speed, Cadence, Watts)
  let streams: ActivityStreamPoint[] = [];
  try {
    const streamsUrl = `https://www.strava.com/api/v3/activities/${stravaId}/streams?keys=time,distance,altitude,velocity_smooth,heartrate,cadence,watts&key_by_type=true`;
    const streamsRes = await fetch(streamsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (streamsRes.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawStreams: any = await streamsRes.json();
      streams = downsampleStreams(rawStreams, 200);
    }
  } catch (err) {
    console.warn('Konnte Strava Streams nicht laden:', err);
  }

  // Extract primary photo URL if present
  let primaryPhotoUrl: string | null = null;
  if (raw.photos?.primary?.urls) {
    primaryPhotoUrl =
      raw.photos.primary.urls['600'] ||
      raw.photos.primary.urls['100'] ||
      Object.values(raw.photos.primary.urls)[0] as string ||
      null;
  }

  // Format splits
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const splitsMetric: ActivitySplit[] = (raw.splits_metric || []).map((s: any) => ({
    split: s.split,
    distance: s.distance,
    elapsed_time: s.elapsed_time,
    moving_time: s.moving_time,
    elevation_difference: s.elevation_difference,
    average_speed: s.average_speed,
    average_heartrate: s.average_heartrate ?? null,
    pace_zone: s.pace_zone ?? null,
  }));

  // Format best efforts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bestEfforts: ActivityBestEffort[] = (raw.best_efforts || []).map((b: any) => ({
    id: b.id,
    name: b.name,
    elapsed_time: b.elapsed_time,
    moving_time: b.moving_time,
    distance: b.distance,
    pr_rank: b.pr_rank ?? null,
  }));

  // Format segment efforts (top 15)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const segmentEfforts: ActivitySegmentEffort[] = (raw.segment_efforts || []).slice(0, 15).map((se: any) => ({
    id: se.id,
    name: se.name,
    elapsed_time: se.elapsed_time,
    moving_time: se.moving_time,
    distance: se.distance,
    pr_rank: se.pr_rank ?? null,
    kom_rank: se.kom_rank ?? null,
    segment: se.segment
      ? {
          id: se.segment.id,
          name: se.segment.name,
          city: se.segment.city,
          average_grade: se.segment.average_grade,
          elevation_high: se.segment.elevation_high,
          elevation_low: se.segment.elevation_low,
        }
      : undefined,
  }));

  const detailData: ActivityDetailData = {
    id: activity.id,
    stravaId,
    name: raw.name || activity.name,
    description: raw.description || null,
    sportType: raw.sport_type || raw.type || activity.sportType,
    startDate: raw.start_date || activity.startDate.toISOString(),
    distance: raw.distance || activity.distance,
    movingTime: raw.moving_time || activity.movingTime,
    elapsedTime: raw.elapsed_time || activity.elapsedTime,
    totalElevationGain: raw.total_elevation_gain ?? activity.totalElevationGain,
    elevHigh: raw.elev_high ?? null,
    elevLow: raw.elev_low ?? null,
    calories: raw.calories ?? null,
    averageHeartrate: raw.average_heartrate ?? activity.averageHeartrate,
    maxHeartrate: raw.max_heartrate ?? activity.maxHeartrate,
    averageCadence: raw.average_cadence ?? null,
    averageSpeed: raw.average_speed ?? activity.averageSpeed,
    maxSpeed: raw.max_speed ?? activity.maxSpeed,
    averageTemp: raw.average_temp ?? null,
    averageWatts: raw.average_watts ?? null,
    maxWatts: raw.max_watts ?? null,
    weightedAverageWatts: raw.weighted_average_watts ?? null,
    kilojoules: raw.kilojoules ?? null,
    deviceWatts: Boolean(raw.device_watts),
    sufferScore: raw.suffer_score ?? null,
    deviceName: raw.device_name ?? null,
    gear: raw.gear
      ? {
          id: raw.gear.id,
          name: raw.gear.name,
          distance: raw.gear.distance,
        }
      : null,
    photos: {
      count: raw.photos?.count || 0,
      primaryUrl: primaryPhotoUrl,
    },
    splitsMetric,
    bestEfforts,
    segmentEfforts,
    summaryPolyline: raw.map?.summary_polyline || activity.summaryPolyline,
    detailedPolyline: raw.map?.polyline || null,
    streams,
    cachedAt: new Date().toISOString(),
  };

  // 4. Save to Database Cache
  try {
    await db.activity.update({
      where: { stravaId },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detailJson: detailData as any,
      },
    });
  } catch (dbErr) {
    console.error('Fehler beim Speichern der Activity-Detaildaten in der DB:', dbErr);
  }

  return detailData;
}
