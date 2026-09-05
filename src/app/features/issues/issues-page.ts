import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { TicketsService } from '../../core/tickets.service';
import { PhotoZoom } from '../../shared/photo-zoom';
import { INSTITUTIONS } from '../../core/institutions';
import type { PublicTicket, TicketStatus } from '../../core/models';

/**
 * Results for the nav's "Issues by Region" search — the public feed.
 *
 * Reads `public_tickets`, a view that publishes the reporter's name and
 * withholds their phone number, so anyone can browse a region without an
 * account. Backing a report needs one, because an upvote has to be attributable
 * to stop the same person voting twice.
 *
 * Ordered by weight, not recency: a problem fifty people are living with should
 * not slide down the page because somebody filed something newer.
 */
@Component({
  selector: 'cp-issues-page',
  standalone: true,
  imports: [RouterLink, DatePipe, PhotoZoom],
  template: `
    <div class="page">
      <h1>Issues in {{ label() }}</h1>
      <p class="muted lead">
        {{ wards().length }} matching
        {{ wards().length === 1 ? 'institution' : 'institutions' }}:
        {{ wards().join(', ') || 'none' }}
      </p>

      @if (!auth.isAuthenticated()) {
        <p class="alert alert-ok">
          Anyone can read these. <a routerLink="/auth">Sign in</a> to back a report you are also
          affected by — that pushes it up the ward desk's list.
        </p>
      }

      @if (error(); as message) {
        <p class="alert alert-error" role="alert">{{ message }}</p>
      }

      @if (loading()) {
        <p class="muted">Searching…</p>
      } @else if (tickets().length === 0) {
        <p class="muted">No reports in this region yet.</p>
      } @else {
        <div class="list">
          @for (ticket of tickets(); track ticket.id) {
            <article class="card row">
              <img cpZoom [src]="ticket.image_url" [alt]="'Reported ' + ticket.category" />

              <div class="detail">
                <p class="number">{{ ticket.ticket_number }}</p>
                <h2>{{ ticket.category }}</h2>
                <p class="muted meta">
                  {{ ticket.ward_location }} · reported
                  {{ ticket.created_at | date: 'd MMM y' }}
                  @if (ticket.user_name) {
                    by {{ ticket.user_name }}
                  }
                </p>
                @if (ticket.description) {
                  <p class="body">{{ ticket.description }}</p>
                }
                <span class="pill" [class]="pill(ticket.status)">{{ ticket.status }}</span>
              </div>

              <!-- Weight, and the way to add to it. -->
              <div class="weigh">
                <button
                  type="button"
                  class="up"
                  [class.mine]="upvoted().has(ticket.id)"
                  [disabled]="pendingId() === ticket.id || isClosed(ticket)"
                  [attr.aria-pressed]="upvoted().has(ticket.id)"
                  [attr.aria-label]="
                    'I have this problem too — ' + ticket.ticket_number
                  "
                  (click)="toggle(ticket)"
                >
                  <span class="chev" aria-hidden="true">▲</span>
                  <span class="count">{{ ticket.upvote_count }}</span>
                </button>
                <p class="muted affected">
                  {{ ticket.upvote_count === 1 ? 'person' : 'people' }} affected
                </p>
                @if (!isClosed(ticket)) {
                  <p class="muted hint">
                    {{ upvoted().has(ticket.id) ? 'You backed this' : 'Me too' }}
                  </p>
                }
              </div>
            </article>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .lead {
      margin-top: -6px;
      margin-bottom: 20px;
    }

    .list {
      display: grid;
      gap: 14px;
    }

    .row {
      display: grid;
      grid-template-columns: 110px 1fr 92px;
      gap: 16px;
      align-items: center;
    }

    .row img {
      width: 110px;
      height: 82px;
      object-fit: cover;
      border-radius: var(--radius);
      border: 1px solid var(--line);
    }

    .number {
      font-family: var(--font-display);
      font-size: 0.74rem;
      letter-spacing: 0.1em;
      color: var(--accent-strong);
      margin: 0 0 3px;
    }

    .row h2 {
      margin: 0 0 3px;
      font-size: 1.06rem;
    }

    .meta {
      font-size: 0.83rem;
      margin: 0;
    }

    .body {
      margin: 7px 0 9px;
      font-size: 0.88rem;
    }

    /* ------------------------------------------------------------- upvote */

    .weigh {
      text-align: center;
    }

    .up {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      padding: 9px 6px;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius);
      background: var(--surface-elevated);
      color: var(--ink);
      cursor: pointer;
      transition:
        border-color 0.15s ease,
        background 0.15s ease;
    }

    .up:hover:not(:disabled) {
      border-color: var(--accent);
      background: var(--accent-soft);
    }

    .up.mine {
      border-color: var(--accent);
      background: var(--accent-soft);
      color: var(--accent-strong);
    }

    .up:disabled {
      opacity: 0.55;
      cursor: default;
    }

    .up:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    .chev {
      font-size: 0.72rem;
      line-height: 1;
    }

    .count {
      font-family: var(--font-display);
      font-size: 1.25rem;
      font-weight: 800;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }

    .affected,
    .hint {
      margin: 4px 0 0;
      font-size: 0.72rem;
      line-height: 1.25;
    }

    .hint {
      margin-top: 1px;
    }

    @media (max-width: 620px) {
      .row {
        grid-template-columns: 1fr auto;
      }

      .row img {
        grid-column: 1 / -1;
        width: 100%;
        height: 150px;
      }
    }
  `,
})
export class IssuesPage {
  private readonly service = inject(TicketsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly tickets = signal<PublicTicket[]>([]);
  protected readonly upvoted = signal<Set<string>>(new Set());
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly pendingId = signal<string | null>(null);
  protected readonly label = signal('your region');
  protected readonly wards = signal<string[]>([]);

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const city = params.get('city')?.trim() ?? '';
      const pincode = params.get('pincode')?.trim() ?? '';

      this.label.set(city || pincode || 'your region');

      const matched = INSTITUTIONS.filter((institution) =>
        pincode
          ? institution.pincode.startsWith(pincode)
          : institution.city.toLowerCase().includes(city.toLowerCase()),
      ).map((institution) => institution.name);

      this.wards.set(matched);
      void this.load(matched);
    });
  }

  protected pill(status: TicketStatus): string {
    if (status === 'Resolved') return 'pill-resolved';
    if (status === 'Rejected') return 'pill-high';
    if (status === 'In Progress') return 'pill-progress';
    return 'pill-submitted';
  }

  /** A closed report has nothing left to prioritise, so backing it is refused. */
  protected isClosed(ticket: PublicTicket): boolean {
    return ticket.status === 'Resolved' || ticket.status === 'Rejected';
  }

  protected async toggle(ticket: PublicTicket): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/auth'], {
        queryParams: { redirect: this.router.url },
      });
      return;
    }

    const had = this.upvoted().has(ticket.id);
    this.pendingId.set(ticket.id);
    this.error.set(null);

    try {
      if (had) {
        await this.service.removeUpvote(ticket.id);
      } else {
        await this.service.upvote(ticket.id);
      }

      // Adjust locally rather than refetching the whole region: the server has
      // already accepted the change, and a full reload would lose the reader's
      // scroll position mid-list.
      this.upvoted.update((set) => {
        const next = new Set(set);
        if (had) next.delete(ticket.id);
        else next.add(ticket.id);
        return next;
      });

      this.tickets.update((list) =>
        list.map((row) =>
          row.id === ticket.id
            ? { ...row, upvote_count: row.upvote_count + (had ? -1 : 1) }
            : row,
        ),
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not record that.');
    } finally {
      this.pendingId.set(null);
    }
  }

  private async load(wards: string[]): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [tickets, mine] = await Promise.all([
        this.service.listPublicByWards(wards),
        this.service.myUpvotedIds(),
      ]);

      this.tickets.set(tickets);
      this.upvoted.set(mine);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Search failed.');
    } finally {
      this.loading.set(false);
    }
  }
}
