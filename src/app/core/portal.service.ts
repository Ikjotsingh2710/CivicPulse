/**
 * The portal layer as the rest of the app sees it.
 *
 * Pages hand this a ticket and get back "here is where it goes and here is the
 * button". They never name a connector class, never build a portal URL, and
 * never learn whether the connector behind it is assisted or an API — which is
 * what lets a jurisdiction move from one to the other without touching them.
 */

import { Injectable, inject, signal } from '@angular/core';

import { INSTITUTIONS } from './institutions';
import { PhotoService } from './photo.service';
import { supabase } from './supabase.client';
import { describeSupabaseError } from './supabase.errors';
import type { GrievanceTicket } from './models';
import type {
  HandoffResult,
  Jurisdiction,
  Portal,
  PortalConnector,
  PreparedComplaint,
} from './portal/connector';
import { createConnector } from './portal/connector.factory';
import { candidatesFor, routeComplaint, type RoutingDecision } from './portal/jurisdiction';

/** How long a handoff may sit unconfirmed before /profile nudges about it. */
export const HANDOFF_REMINDER_MS = 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class PortalService {
  private readonly photos = inject(PhotoService);

  /**
   * The directory, loaded once. A signal rather than a promise because several
   * cards may render before it arrives, and each should fill in when it does.
   */
  private readonly portals = signal<readonly Portal[] | null>(null);
  private loading: Promise<readonly Portal[]> | null = null;

  /** Loads the directory, collapsing concurrent callers onto one request. */
  async directory(): Promise<readonly Portal[]> {
    const cached = this.portals();
    if (cached) return cached;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      const { data, error } = await supabase
        .from('portal_directory')
        .select('*')
        .eq('active', true)
        .order('sort');

      if (error) throw new Error(describeSupabaseError(error, 'Could not load the portal directory.'));

      const rows = (data ?? []) as Portal[];
      this.portals.set(rows);
      return rows;
    })().finally(() => {
      this.loading = null;
    });

    return this.loading;
  }

  /**
   * Whether a report should be offered to a government body at all.
   *
   * Campus reports should not. A pothole inside DTU is the university's to
   * fix, not the corporation's, and sending it to MCD would waste a citizen's
   * afternoon and a clerk's — so campus reports keep the CivicPulse-only flow
   * they already have, ward desk and Pulse Points included.
   *
   * The test is exact-name: `ward_location` on a campus report is set from the
   * institution picker, so it matches a known entry or it is a city.
   */
  offersHandoff(ticket: GrievanceTicket): boolean {
    const ward = ticket.ward_location?.trim();
    if (!ward) return false;
    return !INSTITUTIONS.some((institution) => institution.name === ward);
  }

  /**
   * Works out where a ticket should go.
   *
   * Returns null when nothing is listed for it — a real outcome rather than an
   * error, and the caller shows no handoff at all rather than inventing one.
   */
  async route(
    ticket: GrievanceTicket,
    override?: Jurisdiction,
  ): Promise<{ portal: Portal; decision: RoutingDecision } | null> {
    const portals = await this.directory();

    const decision: RoutingDecision = override
      ? { jurisdiction: override, reason: 'You chose this department.', confident: true }
      : routeComplaint({
          category: ticket.category,
          city: this.cityOf(ticket),
          latitude: ticket.latitude,
          longitude: ticket.longitude,
          description: ticket.description,
          wardLocation: ticket.ward_location,
        });

    const portal = portals.find((row) => row.jurisdiction === decision.jurisdiction);
    if (portal) return { portal, decision };

    // The router named a body the directory does not carry — a seed that never
    // ran, or a row deactivated after this build shipped. CPGRAMS reaches every
    // department nationally, so fall to it rather than dropping the handoff.
    const national = portals.find((row) => row.city === null);
    if (!national) return null;

    return {
      portal: national,
      decision: {
        jurisdiction: national.jurisdiction,
        reason: 'Going to the national grievance portal.',
        confident: false,
      },
    };
  }

  /**
   * The city a ticket sits in.
   *
   * `ward_location` holds either a canonical city name or an institution name.
   * Campus reports do not get a handoff at all, so this only has to recognise
   * the city case; anything unrecognised routes to CPGRAMS, which is correct.
   */
  private cityOf(ticket: GrievanceTicket): string | null {
    return ticket.ward_location?.trim() || null;
  }

  /**
   * The bodies worth offering when the citizen says the guess is wrong.
   *
   * Filtered to the ones that could plausibly act on this problem in this
   * city. Offering all ten turned "this is not MCD's" into a geography quiz,
   * and somebody in Pune has no use for the Delhi Cantonment Board.
   */
  async alternatives(ticket: GrievanceTicket): Promise<readonly Portal[]> {
    const portals = await this.directory();

    const codes = candidatesFor({
      category: ticket.category,
      city: this.cityOf(ticket),
      latitude: ticket.latitude,
      longitude: ticket.longitude,
      description: ticket.description,
      wardLocation: ticket.ward_location,
    });

    return codes
      .map((code) => portals.find((portal) => portal.jurisdiction === code))
      .filter((portal): portal is Portal => portal !== undefined);
  }

  /** Formats a complaint for a portal, ahead of the citizen's click. */
  async prepare(portal: Portal, ticket: GrievanceTicket): Promise<PreparedComplaint> {
    return this.connectorFor(portal).prepare(ticket);
  }

  /**
   * Runs the handoff and records it.
   *
   * The write happens after the connector returns, so a blocked popup does not
   * leave a ticket claiming it was handed off when no portal ever opened.
   */
  async handoff(portal: Portal, prepared: PreparedComplaint): Promise<HandoffResult> {
    const result = await this.connectorFor(portal).handoff(prepared);

    if (result.status === 'awaiting_user_submission') {
      await this.markHandedOff(prepared.ticket.id, portal.jurisdiction);
    }

    return result;
  }

  private connectorFor(portal: Portal): PortalConnector {
    return createConnector(portal, this.photos);
  }

  /**
   * Records that the citizen was sent to a portal.
   *
   * `portal_handed_off_at` is deliberately not sent: the database stamps it,
   * because a device clock that is wrong by hours would make the 24-hour
   * reminder fire immediately or never.
   */
  private async markHandedOff(ticketId: string, jurisdiction: Jurisdiction): Promise<void> {
    const { error } = await supabase
      .from('grievance_tickets')
      .update({
        portal_jurisdiction: jurisdiction,
        portal_status: 'awaiting_user_submission',
      })
      .eq('id', ticketId);

    if (error) throw new Error(describeSupabaseError(error, 'Could not record the handoff.'));
  }

  /**
   * Saves the complaint number the portal issued.
   *
   * This is the only thing CivicPulse learns about the government ticket, and
   * it arrives by the citizen typing it in. Nothing is read from the portal.
   */
  async recordReference(ticketId: string, reference: string): Promise<void> {
    const trimmed = reference.trim();
    if (!trimmed) throw new Error('Enter the reference number the portal gave you.');

    const { error } = await supabase
      .from('grievance_tickets')
      .update({ portal_reference_id: trimmed, portal_status: 'submitted' })
      .eq('id', ticketId);

    if (error) throw new Error(describeSupabaseError(error, 'Could not save that reference number.'));
  }

  /**
   * Whether a handoff has gone unconfirmed long enough to remind about.
   *
   * A reminder links back to the same portal and never resubmits anything —
   * the citizen may well have filed it and simply not told us, so the nudge
   * asks for the reference number rather than asserting nothing happened.
   */
  needsReminder(ticket: GrievanceTicket): boolean {
    if (ticket.portal_status !== 'awaiting_user_submission') return false;
    if (!ticket.portal_handed_off_at) return false;

    const elapsed = Date.now() - new Date(ticket.portal_handed_off_at).getTime();
    return elapsed >= HANDOFF_REMINDER_MS;
  }
}
