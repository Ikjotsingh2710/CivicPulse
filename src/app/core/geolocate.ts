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

/**
 * The worst fix still worth calling a location.
 *
 * GPS outdoors lands at 5-20m and in an urban street at 20-60m; anything past
 * about a hundred metres came from wifi or a cell tower and describes a
 * neighbourhood, not a pothole. A report is required to carry a fix at least
 * this good, because a crew sent to a 2km circle has not been told anything.
 */
export const REQUIRED_ACCURACY_M = 100;

/** How long to keep improving a fix before admitting it will not get better. */
const WATCH_TIMEOUT_MS = 45_000;

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


/**
 * Waits for a fix good enough to send a crew to.
 *
 * `getCurrentPosition` hands back the first fix the device produces, which on
 * a cold start is usually the coarse network estimate — the very thing that
 * makes a report unusable. `watchPosition` keeps delivering improvements as the
 * GPS converges, so this holds on until one is actually precise.
 *
 * `onProgress` receives every intermediate fix, so the UI can show the accuracy
 * tightening rather than presenting an unexplained wait.
 */
export function watchPreciseFix(
  onProgress?: (fix: Fix) => void,
  targetMetres: number = REQUIRED_ACCURACY_M,
): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser cannot share a location.'));
      return;
    }

    let best: Fix | null = null;
    let watchId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const stop = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timer !== null) clearTimeout(timer);
      watchId = null;
      timer = null;
    };

    timer = setTimeout(() => {
      stop();
      // Hand back the best seen so the caller can say how close it got, rather
      // than reporting a bare failure after forty-five seconds of waiting.
      const error = new Error(
        best
          ? `Best fix was accurate to ${Math.round(best.accuracy)}m, which is not precise enough.`
          : 'No location fix arrived.',
      );
      (error as Error & { best?: Fix }).best = best ?? undefined;
      reject(error);
    }, WATCH_TIMEOUT_MS);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const fix: Fix = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        if (!best || fix.accuracy < best.accuracy) best = fix;
        onProgress?.(fix);

        if (fix.accuracy <= targetMetres) {
          stop();
          resolve(fix);
        }
      },
      (error) => {
        // A refused permission will not improve by waiting.
        if (error.code === error.PERMISSION_DENIED) {
          stop();
          reject(error);
        }
      },
      { enableHighAccuracy: true, timeout: WATCH_TIMEOUT_MS, maximumAge: 0 },
    );
  });
}
