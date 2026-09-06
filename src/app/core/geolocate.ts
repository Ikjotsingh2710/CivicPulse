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
  /**
   * True when the fix is tight enough to walk to, false when it is the best the
   * device could manage and describes an area rather than a spot.
   *
   * Both are worth filing — a rough pin still tells a desk which street to look
   * at — but they must never be presented as the same thing, so this travels
   * with the coordinates all the way to the ward desk.
   */
  precise: boolean;
}

/**
 * Beyond this, a fix came from cell towers rather than GPS and cannot answer
 * "am I within 75 metres of that other report?" — so duplicate detection is
 * skipped rather than run on a number that would produce false matches.
 */
export const COARSE_FIX_METRES = 150;

/**
 * The worst fix that may be filed at all. Past this the report is refused.
 *
 * A hundred metres is roughly a city block. Inside it a crew arrives and looks
 * around; outside it they are searching a neighbourhood for a pothole, which is
 * indistinguishable from having no location. Approximate is allowed, vague is
 * not, and this is where the line sits.
 */
export const REQUIRED_ACCURACY_M = 100;

/**
 * The line between a spot and an area, both of which are filable.
 *
 * GPS outdoors lands at 5-20m and in a street between buildings at 20-60m. At
 * or under this the pin is on the right side of the road and a crew walks
 * straight to it. Between here and REQUIRED_ACCURACY_M the fix still names a
 * block, and the report is filed and labelled approximate rather than lost.
 */
export const EXACT_ACCURACY_M = 30;

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
 * Gets the best location the device can give, within a hundred metres.
 *
 * `getCurrentPosition` hands back the first fix the device produces, which on a
 * cold start is the coarse network estimate — a neighbourhood, not a pothole.
 * `watchPosition` keeps delivering improvements as the GPS converges, so this
 * waits for one tight enough to walk to.
 *
 * Two outcomes count as success, and they are not the same thing:
 *
 *   accuracy <= EXACT_ACCURACY_M      a pin. `precise: true`.
 *   accuracy <= ceilingMetres         a block. Filed, `precise: false`.
 *
 * Past the ceiling nothing is filed. That is a deliberate limit rather than a
 * technical one: a fix describing half a suburb tells a crew as little as no
 * fix at all, and recording it would put a confident-looking dot on a map that
 * nobody should trust.
 *
 * `onProgress` receives every intermediate fix, so the UI can show the accuracy
 * tightening rather than presenting an unexplained wait.
 */
export function watchBestFix(
  onProgress?: (fix: Fix) => void,
  ceilingMetres: number = REQUIRED_ACCURACY_M,
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
      resolve({ ...best, precise: best.accuracy <= EXACT_ACCURACY_M });
    };

    timer = setTimeout(() => {
      if (done) return;

      // Time is up. Anything inside the ceiling is filed — it names a block,
      // which is enough to send someone to look.
      if (best && best.accuracy <= ceilingMetres) {
        finish();
        return;
      }

      done = true;
      stop();
      reject(
        new Error(
          best
            ? `The closest fix was ±${Math.round(best.accuracy)}m, and a report needs ${ceilingMetres}m or better.`
            : 'Your device could not get a location fix at all.',
        ),
      );
    }, WATCH_TIMEOUT_MS);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const fix: Fix = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          precise: position.coords.accuracy <= EXACT_ACCURACY_M,
        };

        if (!best || fix.accuracy < best.accuracy) best = fix;
        onProgress?.(fix);

        // A pin. Nothing more to wait for — the remaining metres are the
        // hardware's noise floor, not something more time removes.
        if (fix.accuracy <= EXACT_ACCURACY_M) {
          finish();
          return;
        }

        // Inside the ceiling, so this is already filable — but a converging GPS
        // is usually still improving, and the fix that merely scrapes past the
        // bar is rarely the best one going. Keep watching a little longer.
        if (fix.accuracy <= ceilingMetres && settle === null) {
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
