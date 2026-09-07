/**
 * The contract every government-portal integration implements.
 *
 * There are two kinds of connector and there will only ever be two:
 *
 *   assisted — CivicPulse formats the complaint and opens the portal; the
 *              citizen pastes and submits it themselves, with their own OTP.
 *              Every connector is this one today.
 *   api      — CivicPulse submits directly, once a body has granted official
 *              credentials. Written but not implemented, so the shape of the
 *              app does not have to change on the day that happens.
 *
 * The interface is what makes that swap a one-class change. Nothing outside
 * this folder knows which kind it is holding, so no page needs editing when a
 * jurisdiction moves from one to the other.
 *
 * WHAT NO CONNECTOR MAY EVER DO
 *   Post to a .gov.in or .nic.in form endpoint, read or replay an OTP, or
 *   drive a government site with a headless browser. Those are legal limits,
 *   not technical ones, and an `api` connector does not relax them — it
 *   replaces them with a documented interface the body has agreed to.
 */

import type { GrievanceTicket } from '../models';

/** Jurisdiction codes, matching `portal_directory.jurisdiction`. */
export type Jurisdiction =
  | 'MCD'
  | 'NDMC'
  | 'PWD'
  | 'DJB'
  | 'CANTT'
  | 'BMC'
  | 'BBMP'
  | 'GCC'
  | 'PMC'
  | 'CPGRAMS';

/** One row of `portal_directory`. */
export interface Portal {
  jurisdiction: Jurisdiction;
  name: string;
  /** Canonical city served, or null for the national fallback. */
  city: string | null;
  web_url: string;
  app_url: string | null;
  helpline: string | null;
  connector_type: 'assisted' | 'api';
  active: boolean;
  sort: number;
}

/**
 * A complaint formatted for a particular portal, ready to be handed over.
 *
 * `body` is the part that goes on the clipboard. It is plain text on purpose:
 * government forms are textareas, and anything richer arrives as visible
 * markup in a complaint an official has to read.
 */
export interface PreparedComplaint {
  portal: Portal;
  ticket: GrievanceTicket;
  /** The block the citizen pastes. */
  body: string;
  /** Street address from reverse geocoding, or null if the lookup failed. */
  address: string | null;
  /** Time-limited link that saves the photo to the citizen's device. */
  photoDownloadUrl: string | null;
  /** Where `handoff` will send them — the app if there is one, else the site. */
  targetUrl: string;
}

/**
 * What happened when the connector ran.
 *
 * `awaiting_user_submission` is the honest outcome of an assisted handoff: we
 * got the citizen to the door with everything in hand, and only they can say
 * whether they walked through it. Claiming anything stronger would put a
 * status on /profile that no one had verified.
 */
export interface HandoffResult {
  status: 'awaiting_user_submission' | 'submitted' | 'failed';
  jurisdiction: Jurisdiction;
  /** True when the complaint text reached the clipboard. */
  copied: boolean;
  /** True when the photo download was triggered. */
  photoSaved: boolean;
  /** True when the portal opened; false usually means a popup blocker. */
  opened: boolean;
  /** Set only on failure, phrased for the citizen. */
  message?: string;
}

export interface PortalConnector {
  readonly jurisdiction: Jurisdiction;

  /**
   * False for every connector today. It flips only when a body has granted
   * credentials, and the UI reads it to decide whether to say "Send it" or
   * "Open the portal".
   */
  readonly supportsDirectSubmit: boolean;

  /**
   * Formats the complaint. Async because the address is reverse-geocoded and
   * the photo link has to be signed — both are network round trips.
   *
   * Called ahead of the citizen's click, never during it, so that `handoff`
   * can open a tab without an `await` in front of it. A browser only honours
   * `window.open` while it still considers itself inside the click that caused
   * it, and an await in between is enough to lose that.
   */
  prepare(ticket: GrievanceTicket): Promise<PreparedComplaint>;

  /** Executes the handoff. Must be called directly from a user gesture. */
  handoff(prepared: PreparedComplaint): Promise<HandoffResult>;
}
