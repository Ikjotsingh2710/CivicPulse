/**
 * Getting a location fix on a real phone, reliably.
 *
 * The naive call — `getCurrentPosition(ok, fail, { enableHighAccuracy: true,
 * timeout: 15000 })` — fails constantly in the field, for two reasons that are
 * invisible on a desktop during development:
 *
 *   1. `enableHighAccuracy: true` insists on GPS. A cold GPS start takes 20-60
 *      seconds outdoors and frequently never resolves indoors or under cloud.
 *      Fifteen seconds is not a timeout, it is a coin toss.
 *   2. Omitting `maximumAge` refuses any cached position, so a phone that got a
 *      perfectly good fix ten seconds ago is made to start from scratch.
 *
 * So: accept a recent fix instantly if the device has one, allow GPS a
 * realistic amount of time, and if that still fails fall back to the coarse
 * network fix rather than giving the citizen nothing.
 */

export interface Fix {
  latitude: number;
  longitude: number;
  /** Radius of uncertainty in metres, as reported by the device. */
  accuracy: number;
}

/**
 * Beyond this, a fix came from cell towers rather than GPS and cannot answer
 * "am I within 75 metres of that other report?" — so duplicate detection is
 * skipped rather than run on a number that would produce false matches.
 */
export const COARSE_FIX_METRES = 150;

/** GPS deserves a realistic window; a cold start is routinely 20-30 seconds. */
const PRECISE = { enableHighAccuracy: true, timeout: 30_000, maximumAge: 60_000 };

/** Wifi and cell towers. Coarse, but usually answers in a second or two. */
const COARSE = { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 };

function once(options: PositionOptions): Promise<Fix> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      reject,
      options,
    );
  });
}

/**
 * Tries GPS, then falls back to a network fix.
 *
 * `onFallback` fires when the first attempt gives up, so the UI can explain the
 * wait instead of appearing frozen.
 */
export async function getFix(onFallback?: () => void): Promise<Fix> {
  if (!navigator.geolocation) {
    throw new Error('This browser cannot share a location.');
  }

  try {
    return await once(PRECISE);
  } catch (error) {
    const failure = error as GeolocationPositionError;

    // Retrying a refused permission just prompts again and fails again.
    if (failure?.code === failure?.PERMISSION_DENIED) throw failure;

    onFallback?.();
    return await once(COARSE);
  }
}

export function explainGeolocationError(error: unknown): string {
  const failure = error as GeolocationPositionError;

  if (failure?.code === failure?.PERMISSION_DENIED) {
    return "Location permission was denied. You can allow it in your browser's site settings.";
  }
  if (failure?.code === failure?.POSITION_UNAVAILABLE) {
    return 'Your device could not get a fix. Moving outdoors or near a window usually helps.';
  }
  if (failure?.code === failure?.TIMEOUT) {
    return 'Getting a location fix took too long — GPS can be slow indoors.';
  }

  return (error as Error)?.message || 'Could not read your location.';
}
