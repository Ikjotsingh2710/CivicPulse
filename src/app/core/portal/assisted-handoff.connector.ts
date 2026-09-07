/**
 * The connector that exists today: prepare everything, then get out of the way.
 *
 * A citizen filing on MCD's portal has to supply the category, the location,
 * a description and a photo — all of which they have already given CivicPulse.
 * This formats that into one block, puts it on their clipboard, saves the
 * photo to their device, and opens the portal. They paste, attach, and pass
 * their own OTP.
 *
 * That last sentence is the design. The citizen submits their own complaint,
 * which is what keeps this lawful and what makes the complaint genuinely
 * theirs. CivicPulse removes the retyping and nothing else.
 */

import type { GrievanceTicket } from '../models';
import type { PhotoService } from '../photo.service';
import type {
  HandoffResult,
  Jurisdiction,
  Portal,
  PortalConnector,
  PreparedComplaint,
} from './connector';
import { reverseGeocode } from './reverse-geocode';

/**
 * Above this the pin names a block rather than a spot, so the pasted block
 * says so. Mirrors REQUIRED_ACCURACY_M's companion in geolocate.ts; kept as
 * its own constant because this is about how a location is *described* to an
 * official, not about whether a report may be filed.
 */
const EXACT_ENOUGH_M = 30;

export class AssistedHandoffConnector implements PortalConnector {
  readonly supportsDirectSubmit = false;

  constructor(
    readonly jurisdiction: Jurisdiction,
    private readonly portal: Portal,
    private readonly photos: PhotoService,
  ) {}

  async prepare(ticket: GrievanceTicket): Promise<PreparedComplaint> {
    // Both are optional enrichments, and neither may hold up the handoff, so
    // they run together and each falls back on its own.
    const [address, photoDownloadUrl] = await Promise.all([
      ticket.latitude !== null && ticket.longitude !== null
        ? reverseGeocode(ticket.latitude, ticket.longitude)
        : Promise.resolve(null),
      this.photos.resolveDownload(ticket.image_url),
    ]);

    return {
      portal: this.portal,
      ticket,
      address,
      photoDownloadUrl,
      body: this.format(ticket, address),
      // The app link when the body publishes one — a citizen on a phone lands
      // in an interface built for the phone rather than a desktop site.
      targetUrl: this.portal.app_url ?? this.portal.web_url,
    };
  }

  /**
   * Writes the complaint into a shape a government form will accept.
   *
   * Deliberately plain text with labelled lines. Portal forms are single
   * textareas; a clerk reading a hundred of these can find the address on
   * every one in the same place, and nothing arrives as stray markup.
   */
  private format(ticket: GrievanceTicket, address: string | null): string {
    const lines: string[] = [];

    lines.push(`Complaint: ${ticket.category}`);
    lines.push('');

    if (ticket.description?.trim()) {
      lines.push(ticket.description.trim());
      lines.push('');
    }

    lines.push('LOCATION');
    if (address) lines.push(address);
    lines.push(`Area: ${ticket.ward_location}`);

    if (ticket.latitude !== null && ticket.longitude !== null) {
      const lat = ticket.latitude.toFixed(6);
      const lng = ticket.longitude.toFixed(6);
      lines.push(`Coordinates: ${lat}, ${lng}`);
      lines.push(`Map: https://www.google.com/maps?q=${lat},${lng}`);

      const metres = ticket.location_accuracy_m;
      if (metres !== null && metres > EXACT_ENOUGH_M) {
        // Saying so costs a line and stops a crew treating a block-level pin
        // as a doorstep. An unqualified coordinate implies a precision the
        // reading does not have.
        lines.push(`(GPS accurate to about ${Math.round(metres)} metres)`);
      }
    }

    lines.push('');
    lines.push(`Reported: ${new Date(ticket.created_at).toLocaleString('en-IN')}`);
    lines.push(`Urgency: ${ticket.urgency}`);
    lines.push(`CivicPulse reference: ${ticket.ticket_number}`);
    lines.push('');
    lines.push('Photo of the issue is attached.');

    return lines.join('\n');
  }

  /**
   * Runs the handoff. Must be called straight from the click.
   *
   * The order is not cosmetic. `window.open` is the only step a browser will
   * refuse if it no longer believes it is inside a user gesture, and an
   * `await` before it is enough to lose that belief — so the tab opens first
   * and the awaited work happens behind it.
   */
  async handoff(prepared: PreparedComplaint): Promise<HandoffResult> {
    const opened = this.openPortal(prepared.targetUrl);
    const photoSaved = this.savePhoto(prepared);
    const copied = await this.copy(prepared.body);

    if (!opened) {
      return {
        status: 'failed',
        jurisdiction: this.jurisdiction,
        copied,
        photoSaved,
        opened: false,
        message:
          `Your browser blocked the popup, so ${this.portal.name} did not open. ` +
          'Allow popups for this site, or use the direct link below.',
      };
    }

    return {
      status: 'awaiting_user_submission',
      jurisdiction: this.jurisdiction,
      copied,
      photoSaved,
      opened: true,
    };
  }

  private openPortal(url: string): boolean {
    // noopener: the portal gets no handle on the CivicPulse window.
    const tab = window.open(url, '_blank', 'noopener,noreferrer');
    return tab !== null;
  }

  /**
   * Starts the photo download.
   *
   * The link is signed with a content-disposition of attachment, which is what
   * makes a cross-origin file save instead of navigating — the `download`
   * attribute alone is ignored across origins.
   */
  private savePhoto(prepared: PreparedComplaint): boolean {
    if (!prepared.photoDownloadUrl) return false;

    try {
      const link = document.createElement('a');
      link.href = prepared.photoDownloadUrl;
      link.download = `${prepared.ticket.ticket_number}.jpg`;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      return true;
    } catch {
      // The citizen can still save it from the report; not worth failing over.
      return false;
    }
  }

  private async copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Denied permission, or an insecure context. The UI shows the block with
      // a manual copy button, so this is a degradation and not a failure.
      return false;
    }
  }
}
