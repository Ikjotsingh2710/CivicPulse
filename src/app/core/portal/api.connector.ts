/**
 * Direct submission over an official API. Not implemented — deliberately.
 *
 * This class exists so that the day a body grants credentials, the work is
 * writing one implementation here and flipping one column in
 * `portal_directory`. No page, service, or route changes: everything upstream
 * already talks to `PortalConnector` rather than to a concrete class.
 *
 * WHAT WOULD MAKE THIS LEGITIMATE
 *   A written grant of API access from the body itself — MCD, DJB, DARPG or
 *   another — with credentials issued to CivicPulse and an endpoint they
 *   document and intend third parties to call.
 *
 * WHAT WOULD NOT
 *   Discovering that a portal's own web form posts somewhere convenient.
 *   Scripting a browser against it. Passing an OTP on a citizen's behalf.
 *   None of those become acceptable because the code is structured for them,
 *   and this class must never be completed by those means.
 */

import type { GrievanceTicket } from '../models';
import type {
  HandoffResult,
  Jurisdiction,
  Portal,
  PortalConnector,
  PreparedComplaint,
} from './connector';

export class ApiConnector implements PortalConnector {
  /**
   * True is what distinguishes this connector to the UI — it is the flag that
   * turns "Open the portal" into a real send. It stays true here even though
   * the methods throw, because the flag describes the *kind* of connector; a
   * row only ever selects this class once its API genuinely exists.
   */
  readonly supportsDirectSubmit = true;

  constructor(
    readonly jurisdiction: Jurisdiction,
    private readonly portal: Portal,
  ) {}

  async prepare(_ticket: GrievanceTicket): Promise<PreparedComplaint> {
    // TODO: Implement once official API credentials are granted by
    // ${this.portal.name}. Map the ticket onto the body's documented request
    // schema; do not reverse-engineer their web form to find one.
    throw new Error(
      `${this.portal.name} has no API integration yet. ` +
        'Set portal_directory.connector_type back to \'assisted\' for this jurisdiction.',
    );
  }

  async handoff(_prepared: PreparedComplaint): Promise<HandoffResult> {
    // TODO: Implement once official API credentials are granted by
    // ${this.portal.name}. Submit through the granted endpoint, with the
    // credentials held server-side in an Edge Function — never in this bundle,
    // which ships to every visitor.
    throw new Error(
      `${this.portal.name} has no API integration yet. ` +
        'Set portal_directory.connector_type back to \'assisted\' for this jurisdiction.',
    );
  }
}
