/**
 * Turning coordinates into an address a government clerk can read.
 *
 * Government complaint forms ask for a street address, not a latitude. Pasting
 * "28.64703, 77.11952" into one is technically the same information and
 * practically useless to the person who has to act on it.
 *
 * WHY NOMINATIM
 *   It is OpenStreetMap's own geocoder: free, no key, no account. Its usage
 *   policy allows roughly one request a second, which is far above anything a
 *   citizen filing a report will produce. Google's equivalent is better in
 *   dense Indian neighbourhoods but bills per call.
 *
 * FAILING WELL
 *   The lookup is a convenience, never a dependency. If it is slow, blocked,
 *   or down, the complaint still hands off carrying coordinates and the ward
 *   name — the citizen just may have to type a street name themselves. A
 *   handoff must never be held up by a third-party map server.
 */

/** Past this, stop waiting and hand off with coordinates instead. */
const LOOKUP_TIMEOUT_MS = 6_000;

/** What one lookup yields. The state drives routing; the address is pasted. */
export interface Place {
  address: string | null;
  state: string | null;
}

/** Places do not change; a repeated lookup of the same spot is waste. */
const cache = new Map<string, Place>();

interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  postcode?: string;
}

/**
 * Builds a short Indian-style address from the parts Nominatim returns.
 *
 * Its own `display_name` is a comma-separated chain that runs all the way out
 * to "India" and often includes the district, the division and the postal
 * circle. That is too long to paste into a form that wants a location, so the
 * fields that identify a place on the ground are picked out instead.
 */
function formatAddress(address: NominatimAddress): string | null {
  const locality =
    address.neighbourhood ?? address.suburb ?? address.city_district ?? null;
  const settlement = address.city ?? address.town ?? address.village ?? null;

  const parts = [address.road, locality, settlement, address.state, address.postcode]
    .filter((part): part is string => Boolean(part && part.trim()))
    // A road inside its own neighbourhood of the same name reads as a stutter.
    .filter((part, index, all) => all.indexOf(part) === index);

  return parts.length ? parts.join(', ') : null;
}

/**
 * Looks up the street address for a fix.
 *
 * Resolves to null rather than throwing on every failure path, because every
 * caller's fallback is the same and none of them should have to write a
 * try/catch around an optional nicety.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  return (await lookupPlace(latitude, longitude)).address;
}

/**
 * The state a fix sits in, for routing to a state grievance portal.
 *
 * Shares the cache and the one request with the address lookup, so routing and
 * formatting a complaint cost a single round trip between them.
 */
export async function reverseGeocodeState(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  return (await lookupPlace(latitude, longitude)).state;
}

async function lookupPlace(latitude: number, longitude: number): Promise<Place> {
  // Five decimal places is about a metre — finer than any fix we accept, and
  // coarse enough that two reports from the same spot share a cache entry.
  const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const nothing: Place = { address: null, state: null };

  const url =
    'https://nominatim.openstreetmap.org/reverse?format=jsonv2' +
    `&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });

    if (!response.ok) {
      cache.set(key, nothing);
      return nothing;
    }

    const data = (await response.json()) as { address?: NominatimAddress };
    const place: Place = {
      address: data.address ? formatAddress(data.address) : null,
      state: data.address?.state?.trim() || null,
    };

    cache.set(key, place);
    return place;
  } catch {
    // Offline, blocked, rate-limited or timed out. All the same to the caller.
    cache.set(key, nothing);
    return nothing;
  }
}
