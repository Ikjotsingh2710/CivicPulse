import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { TicketsService } from '../../core/tickets.service';
import { PhotoZoom } from '../../shared/photo-zoom';
import { PhotoSrc } from '../../shared/photo-src';
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
  imports: [RouterLink, DatePipe, PhotoZoom, FormsModule, PhotoSrc],
  template: `
    <div class="page">
      <h1>Issues in {{ label() }}</h1>

      <!-- Searching here rather than only from the nav popover: this is the
           page people land on, and the one they retype a search into. -->
      <form class="finder card" (ngSubmit)="search()">
        <div class="modes" role="tablist" aria-label="Search by">
          <button
            type="button"
            role="tab"
            [class.active]="mode() === 'city'"
            [attr.aria-selected]="mode() === 'city'"
            (click)="mode.set('city')"
          >
            City
          </button>
          <button
            type="button"
            role="tab"
            [class.active]="mode() === 'pincode'"
            [attr.aria-selected]="mode() === 'pincode'"
            (click)="mode.set('pincode')"
          >
            Pincode
          </button>
        </div>

        <input
          name="q"
          [(ngModel)]="query"
          [placeholder]="mode() === 'city' ? 'e.g. New Delhi, Meerut' : 'e.g. 110042'"
          [attr.inputmode]="mode() === 'pincode' ? 'numeric' : 'text'"
          aria-label="Search a city or pincode"
        />
        <button class="btn-primary" type="submit">Search</button>
      </form>

      <p class="muted lead">
        @if (term()) {
          Reports filed against “{{ term() }}” and its
          {{ wards().length }} {{ wards().length === 1 ? 'campus' : 'campuses' }}.
        } @else {
          The most recent reports from every region. Search above to narrow it down.
        }
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
        <div class="card empty">
          <h2>Nothing reported here yet</h2>
          <p class="muted">
            No reports match “{{ label() }}”. Try something broader — “Delhi” rather than a
            specific campus — or be the first to report it.
          </p>
          <a class="btn-primary link-btn" routerLink="/">Report an issue</a>
        </div>
      } @else {
        <div class="list">
          @for (ticket of tickets(); track ticket.id) {
            <article class="card row">
              <!-- A photo nobody has reviewed is not published. The report
                   still shows, so it can still be backed while it is checked. -->
              @if (ticket.image_url; as photo) {
                <img cpZoom [cpPhoto]="photo" [alt]="'Reported ' + ticket.category" />
              } @else {
                <div class="pending" role="img" aria-label="Photo awaiting review">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>
                    <path d="M12 7.5v5l3 2" fill="none" stroke="currentColor"
                          stroke-width="1.6" stroke-linecap="round"/>
                  </svg>
                  <span>Photo under review</span>
                </div>
              }

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
      margin-bottom: 20px;
    }

    .finder {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      margin: 14px 0 14px;
      padding: 12px;
    }

    .finder input {
      flex: 1;
      min-width: 180px;
    }

    .modes {
      display: flex;
      gap: 4px;
      background: var(--surface-sunken);
      border-radius: 9px;
      padding: 3px;
    }

    .modes button {
      appearance: none;
      border: none;
      background: none;
      border-radius: 7px;
      padding: 7px 13px;
      font-family: var(--font-body);
      font-size: 0.86rem;
      font-weight: 600;
      color: var(--ink-muted);
      cursor: pointer;
    }

    .modes button.active {
      background: var(--surface-elevated);
      color: var(--accent-strong);
      box-shadow: var(--shadow-elevated);
    }

    .empty {
      text-align: center;
      padding: 32px 20px;
    }

    .empty h2 {
      margin-bottom: 6px;
    }

    .empty p {
      max-width: 46ch;
      margin: 0 auto 18px;
    }

    .link-btn {
      display: inline-block;
      text-decoration: none;
      padding: 11px 18px;
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

    .pending {
      width: 110px;
      height: 82px;
      border-radius: var(--radius);
      border: 1px dashed var(--line-strong);
      background: var(--surface-sunken);
      color: var(--ink-muted);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
      text-align: center;
      font-size: 0.68rem;
      line-height: 1.25;
      padding: 6px;
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
  /** The raw search text, matched against ward_location case-insensitively. */
  protected readonly term = signal('');

  /** Bound to the on-page search box. */
  protected readonly mode = signal<'city' | 'pincode'>('city');
  protected query = '';

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const city = params.get('city')?.trim() ?? '';
      const pincode = params.get('pincode')?.trim() ?? '';

      this.label.set(city || pincode || 'your region');

      // `''.includes('')` is true, so an empty search used to match all 26
      // campuses and claim it had searched them.
      const matched = INSTITUTIONS.filter((institution) =>
        pincode
          ? institution.pincode.startsWith(pincode)
          : city !== '' && institution.city.toLowerCase().includes(city.toLowerCase()),
      ).map((institution) => institution.name);

      this.wards.set(matched);
      this.term.set(pincode || city);

      // Keep the box showing what produced these results, so refining a search
      // means editing the term rather than retyping it.
      this.query = pincode || city;
      this.mode.set(pincode ? 'pincode' : 'city');

      void this.load(this.term(), matched);
    });
  }

  /**
   * Re-runs the search from the on-page box.
   *
   * Navigating to the URL we are already on would not re-emit queryParamMap,
   * so an unchanged term would appear to do nothing. Loading directly covers
   * that case; the URL is still updated so the search stays shareable.
   */
  protected search(): void {
    const q = this.query.trim();

    void this.router.navigate(['/issues'], {
      queryParams: q ? { [this.mode()]: q } : {},
      replaceUrl: true,
    });

    const matched = INSTITUTIONS.filter((institution) =>
      this.mode() === 'pincode'
        ? institution.pincode.startsWith(q)
        : q !== '' && institution.city.toLowerCase().includes(q.toLowerCase()),
    ).map((institution) => institution.name);

    this.label.set(q || 'your region');
    this.term.set(q);
    this.wards.set(matched);
    void this.load(q, matched);
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

  private async load(term: string, wards: string[]): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [tickets, mine] = await Promise.all([
        this.service.listPublicByRegion(term, wards),
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
