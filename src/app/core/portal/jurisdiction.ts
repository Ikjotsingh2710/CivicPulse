/**
 * Working out which body owns a problem.
 *
 * India's civic bodies divide work two ways at once — by subject and by
 * territory — so both have to be consulted:
 *
 *   subject    Water is the Jal Board's wherever you stand in Delhi. Roads
 *              split between PWD (arterial) and the corporation (local).
 *   territory  The same pothole belongs to MCD, NDMC or the Cantonment Board
 *              depending on which side of a boundary it sits on.
 *
 * HOW EXACT THIS IS
 *   Official ward boundaries are not published as free, machine-readable
 *   polygons, so the territory test uses rectangles drawn around the two
 *   Delhi zones that are genuinely distinct from MCD's: the NDMC area
 *   (roughly Lutyens' Delhi) and Delhi Cantonment. A rectangle is a coarse
 *   stand-in for a boundary and will be wrong at the edges, which is why the
 *   citizen is always shown which body was chosen and can change it.
 *
 *   This is honest guesswork presented as guesswork — not a claim of accuracy
 *   the data cannot support.
 */

import type { Jurisdiction } from './connector';

/**
 * A rectangle in degrees. Not a boundary — a usable approximation of one, for
 * the two zones where sending a complaint to the wrong body wastes a citizen's
 * afternoon.
 */
interface ZoneBox {
  jurisdiction: Jurisdiction;
  label: string;
  south: number;
  north: number;
  west: number;
  east: number;
}

/**
 * Delhi's non-MCD zones.
 *
 * NDMC covers the government quarter — India Gate, Connaught Place, the
 * ministries, Chanakyapuri. Delhi Cantonment is administered by the army's
 * cantonment board rather than by any civil corporation. Everything else in
 * the NCT is MCD's, which is why MCD needs no box: it is the default.
 */
const DELHI_ZONES: readonly ZoneBox[] = [
  {
    jurisdiction: 'NDMC',
    label: "Lutyens' Delhi",
    south: 28.5766,
    north: 28.6395,
    west: 77.1751,
    east: 77.2452,
  },
  {
    jurisdiction: 'CANTT',
    label: 'Delhi Cantonment',
    south: 28.5561,
    north: 28.6127,
    west: 77.1108,
    east: 77.1755,
  },
];

/**
 * Roads wide enough to be the Public Works Department's rather than the
 * corporation's.
 *
 * PWD maintains Delhi's arterial network — ring roads, the numbered margs,
 * flyovers — while local streets belong to the corporation. There is no free
 * dataset of which road is which, so this reads the description and ward text
 * the citizen already wrote. A miss costs nothing: it falls through to the
 * corporation, which is where most potholes belong anyway.
 */
const ARTERIAL_HINTS: readonly string[] = [
  'ring road',
  'outer ring',
  'inner ring',
  'flyover',
  'underpass',
  'marg',
  'highway',
  'nh-',
  'national highway',
  'bypass',
  'expressway',
  'elevated',
];

/** Canonical city → the local body listed for it in `portal_directory`. */
const CITY_BODIES: Readonly<Record<string, Jurisdiction>> = {
  'New Delhi': 'MCD',
  Mumbai: 'BMC',
  Bengaluru: 'BBMP',
  Chennai: 'GCC',
  Pune: 'PMC',
};

/**
 * Metro extents, generous enough to include the suburbs each body serves.
 *
 * `ward_location` is a canonical city name when the report came from the
 * homepage picker, but free text like "Ward 12, Rajouri Garden" when it came
 * from the full form — and that matches no city, which would send a Delhi
 * pothole to the national portal. Coordinates do not have that problem, and
 * since every report now carries a fix accurate to a hundred metres or better,
 * they are the more reliable evidence of which city someone is standing in.
 *
 * Deliberately coarse: these separate Delhi from Mumbai, not one ward from the
 * next. The zone boxes above do the fine work.
 */
const CITY_EXTENTS: readonly { city: string; box: Omit<ZoneBox, 'jurisdiction' | 'label'> }[] = [
  { city: 'New Delhi', box: { south: 28.36, north: 28.91, west: 76.83, east: 77.4 } },
  { city: 'Mumbai', box: { south: 18.88, north: 19.35, west: 72.75, east: 73.03 } },
  { city: 'Bengaluru', box: { south: 12.83, north: 13.14, west: 77.44, east: 77.78 } },
  { city: 'Chennai', box: { south: 12.83, north: 13.24, west: 80.12, east: 80.34 } },
  { city: 'Pune', box: { south: 18.4, north: 18.65, west: 73.72, east: 73.99 } },
];

/**
 * The city a fix falls in, or null if it is not one we have a body for.
 *
 * Exported so the service can resolve a city before routing, and so the
 * behaviour is testable without going through a ticket.
 */
export function cityFromCoordinates(
  latitude: number | null,
  longitude: number | null,
): string | null {
  if (latitude === null || longitude === null) return null;

  const hit = CITY_EXTENTS.find(
    ({ box }) =>
      latitude >= box.south &&
      latitude <= box.north &&
      longitude >= box.west &&
      longitude <= box.east,
  );

  return hit?.city ?? null;
}

/** Everything the router needs to decide, gathered in one place. */
export interface RoutingInput {
  category: string;
  /** Canonical city, as stored on the ticket after `city_aliases` runs. */
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Free text the citizen wrote; read only for arterial-road hints. */
  description: string | null;
  wardLocation: string;
}

export interface RoutingDecision {
  jurisdiction: Jurisdiction;
  /** One line explaining the choice, shown to the citizen verbatim. */
  reason: string;
  /**
   * False when the decision rests on something coarse — a category default
   * rather than a zone match, or a city with no local body listed. The UI
   * leans harder on "change it" when this is false.
   */
  confident: boolean;
}

function inBox(box: ZoneBox, lat: number, lng: number): boolean {
  return lat >= box.south && lat <= box.north && lng >= box.west && lng <= box.east;
}

/** The Delhi zone a fix falls in, or null for ordinary MCD territory. */
function delhiZone(lat: number | null, lng: number | null): ZoneBox | null {
  if (lat === null || lng === null) return null;
  return DELHI_ZONES.find((zone) => inBox(zone, lat, lng)) ?? null;
}

function mentionsArterialRoad(input: RoutingInput): boolean {
  const text = `${input.description ?? ''} ${input.wardLocation}`.toLowerCase();
  return ARTERIAL_HINTS.some((hint) => text.includes(hint));
}

/**
 * Picks the body a complaint should go to.
 *
 * Order matters. Subject wins first where a body owns a subject outright —
 * water is the Jal Board's regardless of which Delhi zone you are standing in
 * — and territory decides the rest.
 */
export function routeComplaint(input: RoutingInput): RoutingDecision {
  // Coordinates first. A named city is only as good as what was typed into the
  // ward field, whereas the fix was measured — and every report now carries one.
  const city = cityFromCoordinates(input.latitude, input.longitude) ?? input.city;
  const isDelhi = city === 'New Delhi';

  if (isDelhi) {
    // Water is the Jal Board's across the whole NCT, including inside the
    // NDMC and Cantonment zones. Subject beats territory here.
    if (input.category === 'Water Leakage') {
      return {
        jurisdiction: 'DJB',
        reason: 'Delhi Jal Board handles every water supply and leakage complaint in Delhi.',
        confident: true,
      };
    }

    const zone = delhiZone(input.latitude, input.longitude);

    if (zone) {
      return {
        jurisdiction: zone.jurisdiction,
        reason: `This location falls inside ${zone.label}, which ${
          zone.jurisdiction === 'NDMC' ? 'NDMC' : 'the Cantonment Board'
        } administers rather than MCD.`,
        // The box is an approximation of a real boundary, so a match near its
        // edge deserves less confidence than a subject rule does.
        confident: false,
      };
    }

    if (input.category === 'Potholes' && mentionsArterialRoad(input)) {
      return {
        jurisdiction: 'PWD',
        reason: 'This reads like an arterial road, which PWD maintains rather than the corporation.',
        confident: false,
      };
    }

    return {
      jurisdiction: 'MCD',
      reason: 'MCD covers this part of Delhi.',
      confident: true,
    };
  }

  const local = city ? CITY_BODIES[city] : undefined;
  if (local) {
    return {
      jurisdiction: local,
      reason: `${city} is served by this body.`,
      confident: true,
    };
  }

  // No local body listed for this city. CPGRAMS reaches every central and
  // state department, so there is still somewhere real to send it.
  return {
    jurisdiction: 'CPGRAMS',
    reason: city
      ? `CivicPulse has no local portal for ${city} yet, so this goes to the national grievance portal.`
      : 'This goes to the national grievance portal.',
    confident: false,
  };
}

/** Every jurisdiction, for the "wrong department?" override list. */
export const ALL_JURISDICTIONS: readonly Jurisdiction[] = [
  'MCD',
  'NDMC',
  'PWD',
  'DJB',
  'CANTT',
  'BMC',
  'BBMP',
  'GCC',
  'PMC',
  'CPGRAMS',
];
