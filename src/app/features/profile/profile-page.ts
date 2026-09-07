import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { TicketsService } from '../../core/tickets.service';
import { PhotoZoom } from '../../shared/photo-zoom';
import { PhotoSrc } from '../../shared/photo-src';
import { PortalHandoff } from '../../shared/portal-handoff';
import { TICKET_PIPELINE, type GrievanceTicket, type TicketStatus } from '../../core/models';

@Component({
  selector: 'cp-profile-page',
  standalone: true,
  imports: [RouterLink, DatePipe, PhotoZoom, PhotoSrc, PortalHandoff],
  template: `
    <div class="page">
      <header class="head">
        <div>
          <h1>{{ auth.fullName() || 'Your reports' }}</h1>
          <p class="muted">{{ auth.phone() }}</p>
        </div>
        <a class="btn-ghost link-btn" routerLink="/report">File a new report</a>
      </header>

      @if (error(); as message) {
        <p class="alert alert-error" role="alert">{{ message }}</p>
      }

      @if (loading()) {
        <p class="muted">Loading your tickets…</p>
      } @else if (tickets().length === 0) {
        <div class="card empty">
          <h2>Nothing filed yet</h2>
          <p class="muted">
            Reports you file appear here with a live status trail and the ward desk's resolution
            photos.
          </p>
          <a class="btn-primary link-btn" routerLink="/report">File your first report</a>
        </div>
      } @else {
        <div class="list">
          @for (ticket of tickets(); track ticket.id) {
            <article class="card ticket">
              <header class="ticket-head">
                <div>
                  <p class="number">{{ ticket.ticket_number }}</p>
                  <h2>{{ ticket.category }}</h2>
                  <p class="muted meta">
                    {{ ticket.ward_location }} · filed {{ ticket.created_at | date: 'd MMM y' }}
                  </p>
                </div>
                <span class="pill" [class]="statusPill(ticket.status)">{{ ticket.status }}</span>
              </header>

              @if (ticket.description) {
                <p class="body">{{ ticket.description }}</p>
              }

              @if (ticket.status === 'Rejected') {
                <!-- Shown instead of the progress trail: this report is not
                     moving along it, and saying so plainly beats a stalled
                     timeline the citizen has to interpret. -->
                <div class="rejected">
                  <p class="rej-head">This report was not accepted</p>
                  <p class="rej-why">{{ ticket.rejection_reason }}</p>
                  <p class="muted rej-next">
                    If you think this was a mistake, file it again with a clearer photo.
                  </p>
                </div>
              }

              <ol
                class="timeline"
                [class.muted-trail]="ticket.status === 'Rejected'"
                [attr.data-step]="stepIndex(ticket.status)"
              >
                @for (stage of stages; track stage; let i = $index) {
                  <li [class.done]="i <= stepIndex(ticket.status)">
                    <span class="dot"></span>
                    <span class="label">{{ stage }}</span>
                  </li>
                }
              </ol>
              <p class="muted meta">Last updated {{ ticket.updated_at | date: 'd MMM y, h:mm a' }}</p>

              <div class="photos">
                <figure>
                  <img cpZoom [cpPhoto]="ticket.image_url" [alt]="'Reported ' + ticket.category" />
                  <figcaption class="muted">Before</figcaption>
                </figure>
                @if (ticket.resolution_image_url) {
                  <figure>
                    <img cpZoom [cpPhoto]="ticket.resolution_image_url" alt="Resolution proof" />
                    <figcaption class="muted">After</figcaption>
                  </figure>
                }
              </div>

              <!-- Both tickets on one card: CivicPulse's, and the government
                   one. A citizen should not have to remember which portal they
                   used last Tuesday. -->
              <cp-portal-handoff [ticket]="ticket" (tracked)="reload()" />
            </article>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }

    .head h1 {
      margin-bottom: 2px;
    }

    .link-btn {
      display: inline-block;
      text-decoration: none;
      padding: 11px 18px;
      border-radius: var(--radius);
      font-weight: 600;
      border: 1px solid var(--line-strong);
      color: var(--ink);
    }

    .link-btn:hover {
      background: var(--surface-sunken);
    }

    .btn-primary.link-btn {
      background: var(--accent);
      color: var(--ink-inverse);
      border-color: transparent;
    }

    .list {
      display: grid;
      gap: 18px;
    }

    .ticket-head {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: flex-start;
    }

    .number {
      font-family: var(--font-display);
      font-size: 0.76rem;
      letter-spacing: 0.1em;
      color: var(--accent-strong);
      margin: 0 0 4px;
    }

    .ticket h2 {
      margin: 0 0 4px;
      font-size: 1.15rem;
    }

    .meta {
      font-size: 0.84rem;
      margin: 0;
    }

    .body {
      margin: 14px 0 0;
    }

    .timeline {
      list-style: none;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0;
      padding: 0;
      margin: 20px 0 8px;
    }

    /* A rejected report never walks the rest of the trail, so the trail is
       dimmed rather than removed — it still shows how far the report got. */
    .timeline.muted-trail {
      opacity: 0.45;
    }

    .rejected {
      margin-top: 16px;
      padding: 12px 14px;
      border-radius: var(--radius);
      border: 1px solid var(--danger);
      background: var(--danger-soft);
    }

    .rej-head {
      margin: 0 0 4px;
      font-family: var(--font-display);
      font-weight: 700;
      color: var(--danger);
    }

    .rej-why {
      margin: 0;
      color: var(--ink-strong);
    }

    .rej-next {
      margin: 6px 0 0;
      font-size: 0.84rem;
    }

    .timeline li {
      display: flex;
      flex-direction: column;
      gap: 6px;
      position: relative;
      font-size: 0.82rem;
      color: var(--ink-muted);
    }

    .timeline li::before {
      content: '';
      position: absolute;
      top: 5px;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--line);
    }

    .timeline li.done::before {
      background: var(--accent);
    }

    .timeline li:first-child::before {
      left: 5px;
    }

    .timeline li:last-child::before {
      right: calc(100% - 7px);
    }

    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--surface-elevated);
      border: 2px solid var(--line-strong);
      position: relative;
      z-index: 1;
    }

    .timeline li.done .dot {
      background: var(--accent);
      border-color: var(--accent);
    }

    .timeline li.done .label {
      color: var(--ink-strong);
      font-weight: 600;
    }

    .photos {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      margin-top: 16px;
    }

    .photos figure {
      margin: 0;
    }

    .photos img {
      width: 180px;
      height: 130px;
      object-fit: cover;
      border-radius: var(--radius);
      border: 1px solid var(--line);
      display: block;
    }

    .photos figcaption {
      font-size: 0.76rem;
      margin-top: 5px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .empty {
      text-align: center;
      padding: 44px 22px;
    }

    .empty .link-btn {
      margin-top: 14px;
    }
  `,
})
export class ProfilePage {
  private readonly service = inject(TicketsService);
  protected readonly auth = inject(AuthService);

  protected readonly stages = TICKET_PIPELINE;
  protected readonly tickets = signal<GrievanceTicket[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  protected stepIndex(status: TicketStatus): number {
    return this.stages.indexOf(status);
  }

  protected statusPill(status: TicketStatus): string {
    if (status === 'Resolved') return 'pill-resolved';
    if (status === 'Rejected') return 'pill-high';
    if (status === 'In Progress') return 'pill-progress';
    return 'pill-submitted';
  }

  /** Refetches after a handoff is recorded, so the card shows its new state. */
  protected reload(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.tickets.set(await this.service.listMine());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not load your tickets.');
    } finally {
      this.loading.set(false);
    }
  }
}
