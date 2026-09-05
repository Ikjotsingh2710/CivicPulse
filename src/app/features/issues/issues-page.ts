import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { TicketsService } from '../../core/tickets.service';
import { PhotoZoom } from '../../shared/photo-zoom';
import { INSTITUTIONS } from '../../core/institutions';
import type { GrievanceTicket, TicketStatus } from '../../core/models';

/**
 * Results for the nav's "Issues by Region" search.
 *
 * Scope is set by RLS, not by this page: signed-in citizens see their own
 * reports in the matched wards, admins see everything there. A genuinely public
 * feed would need a new policy over a column-limited view.
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
          <a routerLink="/auth">Sign in</a> to see reports here — CivicPulse only shows a report to
          the person who filed it and to the ward desk.
        </p>
      }

      @if (error(); as message) {
        <p class="alert alert-error" role="alert">{{ message }}</p>
      }

      @if (loading()) {
        <p class="muted">Searching…</p>
      } @else if (tickets().length === 0) {
        <p class="muted">No reports visible to you in this region.</p>
      } @else {
        <div class="list">
          @for (ticket of tickets(); track ticket.id) {
            <article class="card row">
              <img cpZoom [src]="ticket.image_url" [alt]="'Reported ' + ticket.category" />
              <div>
                <p class="number">{{ ticket.ticket_number }}</p>
                <h2>{{ ticket.category }}</h2>
                <p class="muted meta">
                  {{ ticket.ward_location }} · {{ ticket.created_at | date: 'd MMM y' }}
                </p>
              </div>
              <span class="pill" [class]="pill(ticket.status)">{{ ticket.status }}</span>
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
      grid-template-columns: 110px 1fr auto;
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

    @media (max-width: 620px) {
      .row {
        grid-template-columns: 1fr;
      }

      .row img {
        width: 100%;
        height: 150px;
      }
    }
  `,
})
export class IssuesPage {
  private readonly service = inject(TicketsService);
  private readonly route = inject(ActivatedRoute);
  protected readonly auth = inject(AuthService);

  protected readonly tickets = signal<GrievanceTicket[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
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

  private async load(wards: string[]): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.tickets.set(await this.service.listByWards(wards));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Search failed.');
    } finally {
      this.loading.set(false);
    }
  }
}
