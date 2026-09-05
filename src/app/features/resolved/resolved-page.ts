import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TicketsService } from '../../core/tickets.service';
import { PhotoZoom } from '../../shared/photo-zoom';
import type { GrievanceTicket } from '../../core/models';

/**
 * Before-and-after proof for the citizen's own tickets.
 *
 * The "after" image is uploaded by the ward desk; a resolved ticket without one
 * is still listed, because its absence is itself worth seeing.
 */
@Component({
  selector: 'cp-resolved-page',
  standalone: true,
  imports: [RouterLink, DatePipe, PhotoZoom],
  template: `
    <div class="page">
      <header class="head">
        <div>
          <h1>Resolved photos</h1>
          <p class="muted">
            Proof uploaded by the ward desk when your report was closed out.
          </p>
        </div>
        <a class="btn-ghost link-btn" routerLink="/profile">All complaints</a>
      </header>

      @if (error(); as message) {
        <p class="alert alert-error" role="alert">{{ message }}</p>
      }

      @if (loading()) {
        <p class="muted">Loading proof photos…</p>
      } @else if (resolved().length === 0) {
        <div class="card empty">
          <h2>Nothing resolved yet</h2>
          <p class="muted">
            When a ward desk closes one of your reports, the before and after photos appear here.
          </p>
          <a class="btn-primary link-btn primary" routerLink="/report">File a report</a>
        </div>
      } @else {
        <div class="list">
          @for (ticket of resolved(); track ticket.id) {
            <article class="card item">
              <header class="item-head">
                <div>
                  <p class="number">{{ ticket.ticket_number }}</p>
                  <h2>{{ ticket.category }}</h2>
                  <p class="muted sub">
                    {{ ticket.ward_location }} · closed
                    {{ ticket.updated_at | date: 'd MMM y' }}
                  </p>
                </div>
                <span class="pill pill-resolved">Resolved</span>
              </header>

              <div class="pair">
                <figure>
                  <img cpZoom [src]="ticket.image_url" [alt]="'Reported ' + ticket.category" />
                  <figcaption>Before</figcaption>
                </figure>

                @if (ticket.resolution_image_url; as after) {
                  <figure>
                    <img cpZoom [src]="after" alt="Resolution proof photo" />
                    <figcaption class="after">After</figcaption>
                  </figure>
                } @else {
                  <figure class="missing">
                    <div class="placeholder">
                      <p>No proof photo uploaded</p>
                    </div>
                    <figcaption>After</figcaption>
                  </figure>
                }
              </div>
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
      margin-bottom: 22px;
    }

    .head h1 {
      margin-bottom: 2px;
    }

    .head p {
      margin: 0;
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

    .link-btn.primary {
      background: var(--accent);
      color: var(--ink-inverse);
      border-color: transparent;
      margin-top: 14px;
    }

    .list {
      display: grid;
      gap: 18px;
    }

    .item-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 14px;
    }

    .number {
      font-family: var(--font-display);
      font-size: 0.74rem;
      letter-spacing: 0.1em;
      color: var(--accent-strong);
      margin: 0 0 3px;
    }

    .item h2 {
      margin: 0 0 3px;
      font-size: 1.08rem;
    }

    .sub {
      font-size: 0.83rem;
      margin: 0;
    }

    .pair {
      display: grid;
      gap: 14px;
      grid-template-columns: 1fr;
    }

    @media (min-width: 620px) {
      .pair {
        grid-template-columns: 1fr 1fr;
      }
    }

    figure {
      margin: 0;
    }

    figure img,
    .placeholder {
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      border-radius: var(--radius);
      border: 1px solid var(--line);
      display: block;
    }

    .placeholder {
      display: grid;
      place-items: center;
      background: var(--surface-sunken);
      border-style: dashed;
    }

    .placeholder p {
      margin: 0;
      font-size: 0.85rem;
      color: var(--ink-muted);
    }

    figcaption {
      margin-top: 7px;
      font-size: 0.72rem;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      font-weight: 600;
      color: var(--ink-muted);
    }

    figcaption.after {
      color: var(--accent-strong);
    }

    .empty {
      text-align: center;
      padding: 44px 22px;
    }
  `,
})
export class ResolvedPage {
  private readonly service = inject(TicketsService);

  private readonly tickets = signal<GrievanceTicket[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly resolved = computed(() =>
    this.tickets().filter((ticket) => ticket.status === 'Resolved'),
  );

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.tickets.set(await this.service.listMine());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not load proof photos.');
    } finally {
      this.loading.set(false);
    }
  }
}
