import { useEffect } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';

type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

/** Emitted once a queued Strava import has had time to land, so open screens reload. */
export const STRAVA_SYNC_SETTLED = 'strava-sync-settled';

// The server enforces a shared 30-minute cooldown; this only avoids redundant
// requests when the app is foregrounded repeatedly.
const CLIENT_THROTTLE_MS = 5 * 60_000;
const SETTLE_DELAY_MS = 15_000;

let inFlight: Promise<boolean> | null = null;
let lastAttempt = 0;
let settleTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Same trigger the web app sends on every visit (/api/strava/visit).
 * Without it the mobile apps only re-read data that a web visit had imported.
 */
export function requestStravaSync(apiFetch: ApiFetch, force = false): Promise<boolean> {
  if (inFlight) return inFlight;
  if (!force && Date.now() - lastAttempt < CLIENT_THROTTLE_MS) return Promise.resolve(false);
  lastAttempt = Date.now();
  inFlight = apiFetch('/api/strava/visit', { method: 'POST' })
    .then(async response => {
      if (!response.ok) return false;
      const result = await response.json().catch(() => null) as { queued?: boolean } | null;
      if (!result?.queued) return false;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => DeviceEventEmitter.emit(STRAVA_SYNC_SETTLED), SETTLE_DELAY_MS);
      return true;
    })
    .catch(() => false)
    .finally(() => { inFlight = null; });
  return inFlight;
}

/** Triggers the shared Strava import on app start and whenever the app returns to the foreground. */
export function useStravaVisitSync(apiFetch: ApiFetch, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    void requestStravaSync(apiFetch);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void requestStravaSync(apiFetch);
    });
    return () => subscription.remove();
  }, [apiFetch, enabled]);
}

export function useStravaSyncSettled(onSettled: () => void) {
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(STRAVA_SYNC_SETTLED, onSettled);
    return () => subscription.remove();
  }, [onSettled]);
}
