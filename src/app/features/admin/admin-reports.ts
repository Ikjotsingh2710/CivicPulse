import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MediaService } from '../../core/media.service';
import { PhotoZoom } from '../../shared/photo-zoom';
import { PhotoSrc } from '../../shared/photo-src';
import { TicketsService, type AdminTicketFilters } from '../../core/tickets.service';
import { downloadCsv } from './csv';
import {
  REJECTION_REASONS,
  TICKET_CATEGORIES,
  TICKET_PIPELINE,
  TICKET_STATUSES,
  TICKET_URGENCIES,
  type GrievanceTicket,
  type TicketStatus,
} from '../../core/models';

/**
 * The grievance-ticket feed: every citizen report, filterable, with the two
 * workflow actions a desk actually performs — moving the status on and
 * attaching the "after" photo that proves the job was done.
 */
@Component({
  selector: 'cp-admin-reports',
  standalone: true,
  imports: [FormsModule, DatePipe, PhotoZoom, PhotoSrc],
  template: `
    <section class="card filters">
      <div class="field">
        <label for="f-status">Status</label>
        <select id="f-status" [(ngModel)]="status" (ngModelChange)="reload()">
          <option value="">Any</option>
          @for (option of statuses; track option) {
            <option [value]="option">{{ option }}</option>
          }
        </select>
      </div>
      <div class="field">
        <label for="f-urgency">Urgency</label>
        <select id="f-urgency" [(ngModel)]="urgency" (ngModelChange)="reload()">
          <option value="">Any</option>
          @for (option of urgencies; track option) {
            <option [value]="option">{{ option }}</option>
          }
        </select>
      </div>
      <div class="field">
        <label for="f-category">Category</label>
        <select id="f-category" [(ngModel)]="category" (ngModelChange)="reload()">
          <option value="">Any</option>
          @for (option of categories; track option) {
            <option [value]="option">{{ option }}</option>
          }
        </select>
      </div>
      <div class="field">
        <label for="f-ward">Ward / campus</label>
        <input id="f-ward" [(ngModel)]="ward" (change)="reload()" placeholder="Any" />
      </div>
      <div class="field">
        <label for="f-from">Submitted from</label>
        <input id="f-from" type="date" [(ngModel)]="submittedFrom" (ngModelChange)="reload()" />
      </div>
    </section>

    <div class="bar">
      <p class="muted">
        {{ tickets().length }} report{{ tickets().length === 1 ? '' : 's' }} shown
      </p>
      <button
        type="button"
        class="btn-ghost"
        (click)="exportCsv()"
        [disabled]="tickets().length === 0"
      >
        Export CSV
      </button>
    </div>

    @if (error(); as message) {
      <p class="alert alert-error" role="alert">{{ message }}</p>
    }

    @if (loading()) {
      <p class="muted">Loading feed…</p>
    } @else if (tickets().length === 0) {
      <p class="muted">No tickets match these filters.</p>
    } @else {
      <div class="list">
        @for (ticket of tickets(); track ticket.id) {
          <article class="card ticket">
            <img
              cpZoom
              class="thumb"
              [cpPhoto]="ticket.image_url"
              [alt]="'Reported ' + ticket.category"
            />

            <div class="detail">
              <p class="number">{{ ticket.ticket_number }}</p>
              <h2>
                {{ ticket.category }}
                <!-- The queue is ordered by this, so it belongs beside the
                     title rather than buried in the metadata line. -->
                @if (ticket.upvote_count > 0) {
                  <span class="weight" [class.loud]="ticket.upvote_count >= 5">
                    ▲ {{ ticket.upvote_count + 1 }} affected
                  </span>
                }
              </h2>
              <p class="muted meta">
                {{ ticket.ward_location }} · {{ ticket.user_name || 'Citizen' }} ·
                {{ ticket.user_phone }} · {{ ticket.created_at | date: 'd MMM y, h:mm a' }}
              </p>
              @if (ticket.description) {
                <p class="body">{{ ticket.description }}</p>
              }
              @if (ticket.latitude !== null && ticket.longitude !== null) {
                <a class="map" target="_blank" rel="noopener" [href]="mapUrl(ticket)"
                  >View pin on map ↗</a
                >
              }
            </div>

            <div class="actions">
              <span class="pill" [class]="urgencyPill(ticket.urgency)">{{ ticket.urgency }}</span>

              @if (ticket.status === 'Rejected') {
                <!-- Terminal state: the workflow controls would be meaningless
                     here, so the panel shows why and offers only the way back. -->
                <div class="rejected">
                  <p class="rej-head">Rejected</p>
                  <p class="rej-why">{{ ticket.rejection_reason }}</p>
                </div>
                <button
                  type="button"
                  class="btn-ghost wide"
                  (click)="reopen(ticket)"
                  [disabled]="pendingId() === ticket.id"
                >
                  Reopen report
                </button>
              } @else {
                <div class="field">
                  <label [attr.for]="'status-' + ticket.id">Status</label>
                  <select
                    [id]="'status-' + ticket.id"
                    [ngModel]="ticket.status"
                    (ngModelChange)="changeStatus(ticket, $event)"
                    [disabled]="pendingId() === ticket.id"
                  >
                    @for (option of pipeline; track option) {
                      <option [value]="option">{{ option }}</option>
                    }
                  </select>
                </div>

                <!-- Re-filing a mislabelled report keeps a genuine complaint
                     that rejecting it would throw away. -->
                <div class="field">
                  <label [attr.for]="'category-' + ticket.id">Category</label>
                  <select
                    [id]="'category-' + ticket.id"
                    [ngModel]="ticket.category"
                    (ngModelChange)="changeCategory(ticket, $event)"
                    [disabled]="pendingId() === ticket.id"
                  >
                    @for (option of categories; track option) {
                      <option [value]="option">{{ option }}</option>
                    }
                  </select>
                </div>

                <div class="field">
                  <label [attr.for]="'proof-' + ticket.id">Resolution photo</label>
                  <input
                    [id]="'proof-' + ticket.id"
                    type="file"
                    accept="image/*"
                    (change)="uploadProof(ticket, $event)"
                    [disabled]="pendingId() === ticket.id"
                  />
                </div>

                @if (rejectingId() === ticket.id) {
                  <div class="field">
                    <label [attr.for]="'reason-' + ticket.id">Reason the citizen will see</label>
                    <select [id]="'reason-' + ticket.id" [(ngModel)]="rejectReason">
                      @for (option of rejectionReasons; track option) {
                        <option [value]="option">{{ option }}</option>
                      }
                    </select>
                  </div>
                  <div class="reject-row">
                    <button type="button" class="btn-ghost" (click)="cancelReject()">Cancel</button>
                    <button
                      type="button"
                      class="btn-slate"
                      (click)="confirmReject(ticket)"
                      [disabled]="pendingId() === ticket.id"
                    >
                      Reject
                    </button>
                  </div>
                } @else {
                  <button type="button" class="btn-ghost wide" (click)="startReject(ticket)">
                    Reject report…
                  </button>
                }
              }

              @if (ticket.resolution_image_url) {
                <img cpZoom class="proof" [cpPhoto]="ticket.resolution_image_url" alt="Resolution proof" />
              }
            </div>
          </article>
        }
      </div>
    }
  `,
  styles: `
    .filters {
      display: grid;
      gap: 0 16px;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      margin-bottom: 14px;
    }

    .filters .field {
      margin-bottom: 4px;
    }

    .bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .bar p {
      margin: 0;
    }

    .list {
      display: grid;
      gap: 16px;
    }

    .ticket {
      display: grid;
      gap: 18px;
      grid-template-columns: 1fr;
    }

    @media (min-width: 860px) {
      .ticket {
        grid-template-columns: 170px 1fr 230px;
        align-items: start;
      }
    }

    .thumb {
      width: 100%;
      height: 130px;
      object-fit: cover;
      border-radius: var(--radius);
      border: 1px solid var(--line);
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
      font-size: 1.12rem;
    }

    .meta {
      font-size: 0.82rem;
      margin: 0;
    }

    .weight {
      display: inline-block;
      vertical-align: middle;
      margin-left: 8px;
      padding: 2px 8px;
      border-radius: 999px;
      font-family: var(--font-body);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      background: var(--accent-soft);
      color: var(--accent-strong);
    }

    /* Five or more people is no longer a nuisance report. */
    .weight.loud {
      background: var(--warn-soft);
      color: var(--warn);
    }

    .body {
      margin: 10px 0 0;
    }

    .map {
      display: inline-block;
      margin-top: 10px;
      font-size: 0.84rem;
      font-weight: 600;
      text-decoration: none;
    }

    .map:hover {
      text-decoration: underline;
    }

    .actions .field {
      margin-top: 12px;
      margin-bottom: 0;
    }

    .wide {
      width: 100%;
      margin-top: 12px;
    }

    .reject-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 12px;
    }

    .rejected {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: var(--radius);
      border: 1px solid var(--danger);
      background: var(--danger-soft);
    }

    .rej-head {
      margin: 0 0 3px;
      font-family: var(--font-display);
      font-size: 0.74rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--danger);
    }

    .rej-why {
      margin: 0;
      font-size: 0.86rem;
      color: var(--ink-strong);
    }

    .proof {
      margin-top: 12px;
      width: 100%;
      height: 110px;
      object-fit: cover;
      border-radius: var(--radius);
      border: 1px solid var(--line);
    }
  `,
})
export class AdminReports {
  private readonly service = inject(TicketsService);
  private readonly media = inject(MediaService);

  /** All four, for the filter — a desk needs to find rejected reports again. */
  protected readonly statuses = TICKET_STATUSES;
  /**
   * Only the three forward states for the per-ticket dropdown. Rejection goes
   * through its own control instead, because it is the one transition that must
   * carry a reason, and a dropdown cannot ask for one.
   */
  protected readonly pipeline = TICKET_PIPELINE;
  protected readonly urgencies = TICKET_URGENCIES;
  protected readonly categories = TICKET_CATEGORIES;
  protected readonly rejectionReasons = REJECTION_REASONS;

  protected status = '';
  protected urgency = '';
  protected category = '';
  protected ward = '';
  protected submittedFrom = '';

  protected readonly tickets = signal<GrievanceTicket[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly pendingId = signal<string | null>(null);

  /** Which ticket has its reject panel open; only ever one at a time. */
  protected readonly rejectingId = signal<string | null>(null);
  protected readonly rejectReason = signal<string>(REJECTION_REASONS[0]);

  constructor() {
    void this.reload();
  }

  protected urgencyPill(urgency: string): string {
    if (urgency === 'High') return 'pill-high';
    if (urgency === 'Medium') return 'pill-progress';
    return 'pill-submitted';
  }

  protected mapUrl(ticket: GrievanceTicket): string {
    return `https://www.google.com/maps?q=${ticket.latitude},${ticket.longitude}`;
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const filters: AdminTicketFilters = {
      status: (this.status || undefined) as TicketStatus | undefined,
      urgency: this.urgency || undefined,
      category: this.category || undefined,
      wardLocation: this.ward.trim() || undefined,
      submittedFrom: this.submittedFrom || undefined,
    };

    try {
      this.tickets.set(await this.service.listForAdmin(filters));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not load the feed.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Exports exactly what is on screen, filters included. */
  protected exportCsv(): void {
    downloadCsv(
      'civicpulse-reports',
      [
        'Ticket',
        'Created',
        'Status',
        'Urgency',
        'Category',
        'Ward',
        'Name',
        'Phone',
        'Description',
        'Latitude',
        'Longitude',
        'Photo',
        'Resolution photo',
      ],
      this.tickets().map((ticket) => [
        ticket.ticket_number,
        ticket.created_at,
        ticket.status,
        ticket.urgency,
        ticket.category,
        ticket.ward_location,
        ticket.user_name,
        ticket.user_phone,
        ticket.description,
        ticket.latitude,
        ticket.longitude,
        ticket.image_url,
        ticket.resolution_image_url,
      ]),
    );
  }

  protected async changeStatus(ticket: GrievanceTicket, status: TicketStatus): Promise<void> {
    if (status === ticket.status) return;
    this.pendingId.set(ticket.id);
    this.error.set(null);

    try {
      this.replace(await this.service.updateStatus(ticket.id, status));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Status update failed.');
    } finally {
      this.pendingId.set(null);
    }
  }

  protected startReject(ticket: GrievanceTicket): void {
    this.rejectReason.set(REJECTION_REASONS[0]);
    this.rejectingId.set(ticket.id);
  }

  protected cancelReject(): void {
    this.rejectingId.set(null);
  }

  protected async confirmReject(ticket: GrievanceTicket): Promise<void> {
    this.pendingId.set(ticket.id);
    this.error.set(null);

    try {
      this.replace(await this.service.reject(ticket.id, this.rejectReason()));
      this.rejectingId.set(null);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not reject the report.');
    } finally {
      this.pendingId.set(null);
    }
  }

  /** Puts a rejected report back at the start; the trigger clears the reason. */
  protected async reopen(ticket: GrievanceTicket): Promise<void> {
    this.pendingId.set(ticket.id);
    this.error.set(null);

    try {
      this.replace(await this.service.updateStatus(ticket.id, 'Submitted'));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not reopen the report.');
    } finally {
      this.pendingId.set(null);
    }
  }

  protected async changeCategory(ticket: GrievanceTicket, category: string): Promise<void> {
    if (category === ticket.category) return;
    this.pendingId.set(ticket.id);
    this.error.set(null);

    try {
      this.replace(await this.service.updateCategory(ticket.id, category));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not change the category.');
    } finally {
      this.pendingId.set(null);
    }
  }

  protected async uploadProof(ticket: GrievanceTicket, event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.pendingId.set(ticket.id);
    this.error.set(null);

    try {
      const url = await this.media.upload(file, 'resolutions');
      this.replace(await this.service.attachResolutionPhoto(ticket.id, url));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Proof upload failed.');
    } finally {
      this.pendingId.set(null);
    }
  }

  private replace(updated: GrievanceTicket): void {
    this.tickets.update((list) =>
      list.map((ticket) => (ticket.id === updated.id ? updated : ticket)),
    );
  }
}
