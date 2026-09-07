import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { AuthService } from './auth.service';
import { TicketsService } from './tickets.service';
import type { GrievanceTicket, TicketStatus } from './models';

/**
 * Telling a citizen their own report moved.
 *
 * The desk gets notified the moment a report lands. The person who filed it
 * got nothing — their pothole could be marked Resolved and they would only
 * find out by happening to open the app. That is the loop failing to close at
 * the one end that matters, because a citizen who never learns their report
 * worked has no reason to file a second one.
 *
 * WHY NOT REALTIME
 *   The admin notifications use a Realtime subscription because a desk is
 *   sitting in front of the queue and seconds matter. A citizen is not, and a
 *   status change they hear about ten minutes later is no worse than one they
 *   hear about instantly. So this compares against a snapshot in local storage
 *   instead: no socket, no polling, nothing to go wrong while a report is
 *   being filed.
 */
export interface TicketChange {
  ticket_number: string;
  category: string;
  status: TicketStatus;
}

const STORAGE_PREFIX = 'civicpulse.seen.';

@Injectable({ providedIn: 'root' })
export class UpdatesService {
  private readonly auth = inject(AuthService);
  private readonly tickets = inject(TicketsService);

  /** Reports whose status has moved since this device last looked. */
  readonly changes = signal<readonly TicketChange[]>([]);
  readonly count = computed(() => this.changes().length);

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        void this.check();
      } else {
        // Signing out must not leave another person's report numbers on screen.
        this.changes.set([]);
      }
    });
  }

  /**
   * Compares the citizen's tickets against what this device last saw.
   *
   * A ticket absent from the snapshot is not a change — a newly filed report
   * has obviously moved, and announcing it back to the person who just filed
   * it would be noise.
   */
  async check(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;

    try {
      const mine = await this.tickets.listMine();
      const seen = this.readSnapshot();

      const moved = mine
        .filter((ticket) => {
          const before = seen[ticket.id];
          return before !== undefined && before !== ticket.status;
        })
        .map((ticket) => ({
          ticket_number: ticket.ticket_number,
          category: ticket.category,
          status: ticket.status,
        }));

      this.changes.set(moved);

      // First run on a device records everything and announces nothing, which
      // is the correct behaviour for someone signing in on a new phone.
      if (Object.keys(seen).length === 0) this.writeSnapshot(mine);
    } catch {
      // A failed check is not worth surfacing: the citizen loses a badge, not
      // their reports, and the next visit tries again.
    }
  }

  /**
   * Marks everything as seen. Called when the citizen opens their reports,
   * because that is the moment they have actually been told.
   */
  async acknowledge(tickets: readonly GrievanceTicket[]): Promise<void> {
    this.writeSnapshot(tickets);
    this.changes.set([]);
  }

  /** Snapshots are per phone number, so a shared device does not leak. */
  private key(): string {
    return `${STORAGE_PREFIX}${this.auth.phone() ?? 'anonymous'}`;
  }

  private readSnapshot(): Record<string, TicketStatus> {
    try {
      const raw = localStorage.getItem(this.key());
      return raw ? (JSON.parse(raw) as Record<string, TicketStatus>) : {};
    } catch {
      return {};
    }
  }

  private writeSnapshot(tickets: readonly GrievanceTicket[]): void {
    const map: Record<string, TicketStatus> = {};
    for (const ticket of tickets) map[ticket.id] = ticket.status;

    try {
      localStorage.setItem(this.key(), JSON.stringify(map));
    } catch {
      // Private browsing or storage disabled. The badge will reappear next
      // visit, which is a smaller problem than failing the page.
    }
  }
}
