import { Injectable, effect, inject, signal } from '@angular/core';

import { supabase } from './supabase.client';
import { AuthService } from './auth.service';
import type { GrievanceTicket } from './models';

/** How often the count is re-checked when realtime is unavailable or misses one. */
const POLL_MS = 45_000;

/** A report that arrived while the desk was watching. */
export interface ReportAlert {
  id: string;
  ticket_number: string;
  category: string;
  ward_location: string;
  user_name: string | null;
}

/**
 * Tells the ward desk when a new report comes in.
 *
 * Two mechanisms on purpose. Supabase Realtime pushes an event the instant a
 * ticket is inserted, which is what makes the toast feel immediate. Polling
 * runs alongside it because a realtime socket can drop on a flaky phone
 * connection or while the laptop is asleep, and a desk that silently stops
 * being notified is worse than one that is notified 45 seconds late.
 *
 * Admin-only. `start()` does nothing for a citizen, and even if it were called
 * the underlying queries would return nothing — RLS decides what is visible,
 * not this class.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly auth = inject(AuthService);

  /** Reports still sitting at 'Submitted' — the desk's unhandled queue. */
  readonly pending = signal(0);

  /** The most recent arrival, shown as a toast until dismissed. */
  readonly alert = signal<ReportAlert | null>(null);

  private channel: ReturnType<typeof supabase.channel> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  constructor() {
    // Watching admin status rather than navigation. The session restores
    // asynchronously, so on a fresh page load the first NavigationEnd fires
    // while isAdmin() is still false — start() would bail and, with nothing to
    // retry it, an admin who landed on the homepage and stayed there never got
    // a badge or a dot at all. An effect re-runs the moment the signal flips.
    effect(() => {
      if (this.auth.isAdmin()) this.start();
      else this.stop();
    });
  }

  /** Begins watching. Safe to call repeatedly; only the first call does work. */
  start(): void {
    if (this.started || !this.auth.isAdmin()) return;
    this.started = true;

    void this.refresh();

    this.timer = setInterval(() => void this.refresh(), POLL_MS);

    // Requires grievance_tickets to be in the supabase_realtime publication
    // (migration 0010). If it is not, this simply never fires and polling
    // carries the feature on its own.
    this.channel = supabase
      .channel('desk-new-reports')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'grievance_tickets' },
        (payload) => this.onInsert(payload.new as GrievanceTicket),
      )
      .subscribe();
  }

  /** Called on sign-out so the next person to sign in does not inherit a count. */
  stop(): void {
    this.started = false;
    this.pending.set(0);
    this.alert.set(null);

    if (this.timer) clearInterval(this.timer);
    this.timer = null;

    if (this.channel) void supabase.removeChannel(this.channel);
    this.channel = null;
  }

  dismiss(): void {
    this.alert.set(null);
  }

  /**
   * Re-counts the unhandled queue.
   *
   * `head: true` with an exact count asks Postgres for the number without
   * transferring a single row, so this can run every 45 seconds without
   * becoming the app's heaviest request.
   */
  async refresh(): Promise<void> {
    if (!this.auth.isAdmin()) return;

    const { count, error } = await supabase
      .from('grievance_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Submitted');

    if (error) return;

    const next = count ?? 0;
    const previous = this.pending();
    this.pending.set(next);

    // Polling caught something realtime missed. Announce it, but without a
    // ticket number — the count is all this path knows.
    if (next > previous && previous > 0 && !this.alert()) {
      this.alert.set({
        id: 'poll',
        ticket_number: `${next - previous} new`,
        category: next - previous === 1 ? 'report' : 'reports',
        ward_location: '',
        user_name: null,
      });
    }
  }

  private onInsert(ticket: GrievanceTicket): void {
    this.pending.update((n) => n + 1);
    this.alert.set({
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      category: ticket.category,
      ward_location: ticket.ward_location,
      user_name: ticket.user_name,
    });
  }
}
