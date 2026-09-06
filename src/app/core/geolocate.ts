/**
 * Getting the exact spot a report was filed from.
 *
 * There is no such thing as a coordinate without an error bar. GPS solves a
 * position by timing signals from satellites 20,000km up; the atmosphere delays
 * them and buildings reflect them, so the device reports a point *and* the
 * radius it believes that point is within. `coords.accuracy` is the phone's own
 * statement of its uncertainty, not an approximation this app introduces. Under
 * open sky it settles at 3-10m, which is the floor for consumer hardware.
 *
 * What the app controls is which fixes it is willing to accept, and how long it
 * waits before deciding. Both matter more than they look:
 *
 *   1. `getCurrentPosition` returns the *first* fix the device produces, which
 *      on a cold start is the wifi or cell-tower estimate — a neighbourhood,
 *      not a pothole. So this watches instead, and lets GPS converge.
 *   2. Stopping the moment a fix squeaks under the bar throws away the good one
 *      arriving seconds later. A phone that reports 95m is usually mid-descent
 *      towards 10m, so crossing the threshold starts a short settling window
 *      rather than ending the search.
 *
 * Reading the photo's EXIF instead would gain nothing: it comes from the same
 * OS provider with the same accuracy, our live capture writes no EXIF, and EXIF
 * is editable — which is the whole reason capture is live.
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

/**
 * Good enough that waiting longer is not worth a citizen's patience.
 *
 * This is satellite-grade — it puts the pin on the right side of the road. The
 * remaining few metres are the hardware's noise floor, not something more time
 * will remove.
 */
const EXCELLENT_ACCURACY_M = 20;

/**
 * How long to keep watching after a fix first crosses the threshold.
 *
 * A GPS converging past 100m is typically still descending steeply, so the fix
 * that merely qualifies is rarely the best one available. Spending a few more
 * seconds routinely turns a 90m fix into a 10m one; spending much more than
 * this buys nothing but a citizen standing in the street holding a phone.
 */
const SETTLE_MS = 8_000;

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
    let settle: ReturnType<typeof setTimeout> | null = null;
    let done = false;

    const stop = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timer !== null) clearTimeout(timer);
      if (settle !== null) clearTimeout(settle);
      watchId = null;
      timer = null;
      settle = null;
    };

    /** Take the best fix seen and finish. Guarded so it can only happen once. */
    const finish = () => {
      if (done || !best) return;
      done = true;
      stop();
      resolve(best);
    };

    timer = setTimeout(() => {
      if (done) return;

      // A fix that arrived just before the deadline may still be inside its
      // settling window. It qualified; running out of time is no reason to
      // throw it away and send the citizen back to the start.
      if (best && best.accuracy <= targetMetres) {
        finish();
        return;
      }

      done = true;
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

        // Already as good as the hardware gets. More waiting is just waiting.
        if (fix.accuracy <= EXCELLENT_ACCURACY_M) {
          finish();
          return;
        }

        // Qualified, but a converging GPS is usually still improving. Keep the
        // watch open a little longer and take the best of what arrives — the
        // fix that merely scrapes past the bar is rarely the best one going.
        if (fix.accuracy <= targetMetres && settle === null) {
          settle = setTimeout(finish, SETTLE_MS);
        }
      },
      (error) => {
        // A refused permission will not improve by waiting.
        if (error.code === error.PERMISSION_DENIED && !done) {
          done = true;
          stop();
          reject(error);
        }
      },
      { enableHighAccuracy: true, timeout: WATCH_TIMEOUT_MS, maximumAge: 0 },
    );
  });
}
