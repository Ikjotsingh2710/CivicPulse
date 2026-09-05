import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { MediaService } from '../../core/media.service';
import { TicketsService } from '../../core/tickets.service';
import { PhotoZoom } from '../../shared/photo-zoom';
import { DuplicatePrompt } from '../../shared/duplicate-prompt';
import {
  DESCRIPTION_LIMIT,
  TICKET_CATEGORIES,
  TICKET_URGENCIES,
  type DuplicateMatch,
  type GrievanceTicket,
  type TicketUrgency,
} from '../../core/models';
import { CameraCapture, type CapturedLocation } from '../../shared/camera-capture';

@Component({
  selector: 'cp-report-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe, CameraCapture, PhotoZoom, DuplicatePrompt],
  template: `
    <div class="page">
      <h1>File a report</h1>
      <p class="muted lead">
        A photo and a location are what get a ticket actioned. Everything else helps the ward desk
        route it faster.
      </p>

      @if (filed(); as ticket) {
        <div class="card confirmation">
          <p class="pill pill-resolved">Filed</p>
          <h2>{{ ticket.ticket_number }}</h2>
          <p class="muted">
            Your report is with the {{ ticket.ward_location }} desk. Track its status any time from
            your profile.
          </p>
          <div class="row">
            <a class="btn-primary link-btn" routerLink="/profile">Track this ticket</a>
            <button class="btn-ghost" type="button" (click)="fileAnother()">File another</button>
          </div>
        </div>
      } @else {
        <form class="card" (ngSubmit)="submit()">
          @if (error(); as message) {
            <p class="alert alert-error" role="alert">{{ message }}</p>
          }

          <div class="grid">
            <div class="field">
              <label for="category">Category</label>
              <select id="category" name="category" [(ngModel)]="category" required>
                @for (option of categories; track option) {
                  <option [value]="option">{{ option }}</option>
                }
              </select>
            </div>

            <div class="field">
              <label for="urgency">Urgency</label>
              <select id="urgency" name="urgency" [(ngModel)]="urgency" required>
                @for (option of urgencies; track option) {
                  <option [value]="option">{{ option }}</option>
                }
              </select>
            </div>
          </div>

          <div class="field">
            <label for="ward">Ward / campus location</label>
            <input
              id="ward"
              name="ward"
              placeholder="Ward 12, North Campus"
              [(ngModel)]="wardLocation"
              required
            />
          </div>

          <div class="field">
            <label for="description">What's wrong? <span class="opt">optional</span></label>
            <textarea
              id="description"
              name="description"
              [maxlength]="limit"
              placeholder="Describe the damage, how long it has been there, and anything unsafe about it."
              [ngModel]="description()"
              (ngModelChange)="description.set($event)"
            ></textarea>
            <span class="muted coords count">{{ description().length }}/{{ limit }}</span>
          </div>

          <div class="field">
            <label>Photo</label>
            <!-- Live capture only: a gallery upload cannot be trusted to be
                 this issue, at this place, now. -->
            <button class="btn-slate" type="button" (click)="cameraOpen.set(true)">
              <span aria-hidden="true">📷</span>
              {{ previewUrl() ? 'Retake live photo' : 'Snap live photo' }}
            </button>
            @if (previewUrl(); as preview) {
              <img cpZoom class="preview" [src]="preview" alt="Captured report photo" />
            }
          </div>

          <div class="field">
            <label>Location</label>
            <div class="row">
              <button class="btn-ghost" type="button" (click)="captureLocation()" [disabled]="locating()">
                {{ locating() ? 'Locating…' : 'Use my current location' }}
              </button>
              @if (latitude() !== null) {
                <span class="muted coords">
                  {{ latitude() | number: '1.5-5' }}, {{ longitude() | number: '1.5-5' }}
                </span>
              }
            </div>
            @if (locationError(); as message) {
              <p class="muted coords">{{ message }}</p>
            }
          </div>

          <div class="field">
            <label for="department">Department email (optional)</label>
            <input
              id="department"
              name="department"
              type="email"
              placeholder="works.ward12@city.gov"
              [(ngModel)]="departmentEmail"
            />
            <span class="muted coords">
              Set this and the ticket is auto-escalated by email if it is still unresolved after 24
              hours.
            </span>
          </div>

          <button class="btn-primary submit" type="submit" [disabled]="busy()">
            {{ busy() ? 'Filing…' : 'Submit report' }}
          </button>
        </form>
      }
    </div>

    @if (cameraOpen()) {
      <cp-camera-capture
        (captured)="onCaptured($event)"
        (located)="onLocated($event)"
        (dismissed)="cameraOpen.set(false)"
      />
    }

    @if (duplicate(); as match) {
      <cp-duplicate-prompt
        [match]="match"
        [busy]="busy()"
        (same)="backExisting()"
        (different)="fileAnyway()"
      />
    }

    @if (backed(); as number) {
      <p class="alert alert-ok" role="status">
        Added your voice to {{ number }} instead of filing a duplicate.
      </p>
    }
  `,
  styles: `
    .lead {
      max-width: 60ch;
      margin-top: -6px;
      margin-bottom: 22px;
    }

    .grid {
      display: grid;
      gap: 0 16px;
      grid-template-columns: 1fr;
    }

    @media (min-width: 620px) {
      .grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .coords {
      font-size: 0.82rem;
    }

    .count {
      display: block;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .opt {
      text-transform: none;
      letter-spacing: 0.02em;
      font-weight: 400;
      color: var(--ink-muted);
    }

    .preview {
      margin-top: 10px;
      max-height: 220px;
      border-radius: var(--radius);
      border: 1px solid var(--line);
      object-fit: cover;
    }

    .submit {
      width: 100%;
      margin-top: 8px;
    }

    .confirmation h2 {
      margin: 12px 0 6px;
      font-size: 1.9rem;
      letter-spacing: -0.02em;
    }

    .confirmation .row {
      margin-top: 18px;
    }

    .link-btn {
      display: inline-block;
      text-decoration: none;
      padding: 11px 18px;
      border-radius: var(--radius);
    }
  `,
})
export class ReportPage {
  private readonly tickets = inject(TicketsService);
  private readonly media = inject(MediaService);
  protected readonly auth = inject(AuthService);

  protected readonly categories = TICKET_CATEGORIES;
  protected readonly urgencies = TICKET_URGENCIES;

  protected category: string = TICKET_CATEGORIES[0];
  protected urgency: TicketUrgency = 'Medium';
  protected wardLocation = '';
  protected departmentEmail = '';

  protected readonly limit = DESCRIPTION_LIMIT;
  protected readonly description = signal('');

  protected readonly latitude = signal<number | null>(null);
  protected readonly longitude = signal<number | null>(null);
  protected readonly locating = signal(false);
  protected readonly locationError = signal<string | null>(null);

  protected readonly cameraOpen = signal(false);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly filed = signal<GrievanceTicket | null>(null);

  /** A nearby open report this draft may duplicate; drives the prompt. */
  protected readonly duplicate = signal<DuplicateMatch | null>(null);
  /** Ticket number backed instead of filing, for the confirmation message. */
  protected readonly backed = signal<string | null>(null);

  private photo: File | null = null;

  protected onCaptured(file: File): void {
    this.photo = file;

    const previous = this.previewUrl();
    if (previous) URL.revokeObjectURL(previous);
    this.previewUrl.set(URL.createObjectURL(file));

    this.cameraOpen.set(false);
  }

  /** The camera dialog asks for location at the same time, so reuse its fix. */
  protected onLocated(fix: CapturedLocation): void {
    this.latitude.set(fix.latitude);
    this.longitude.set(fix.longitude);
  }

  protected captureLocation(): void {
    if (!navigator.geolocation) {
      this.locationError.set('This browser cannot share a location.');
      return;
    }

    this.locating.set(true);
    this.locationError.set(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.latitude.set(position.coords.latitude);
        this.longitude.set(position.coords.longitude);
        this.locating.set(false);
      },
      (error) => {
        this.locationError.set(`Location unavailable: ${error.message}`);
        this.locating.set(false);
      },
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  }

  protected async submit(): Promise<void> {
    if (this.busy()) return;

    if (!this.photo) {
      this.error.set('Attach a photo of the damage.');
      return;
    }
    if (!this.wardLocation.trim()) {
      this.error.set('Enter the ward or campus location.');
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    try {
      // Before the upload, so a duplicate never puts a second copy of the same
      // pothole in storage.
      const match = await this.tickets.findDuplicate(
        this.category,
        this.latitude(),
        this.longitude(),
      );

      if (match) {
        this.duplicate.set(match);
        return;
      }

      await this.createTicket();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not file the report.');
    } finally {
      this.busy.set(false);
    }
  }

  /** "Yes, same problem" — back the existing report rather than duplicating it. */
  protected async backExisting(): Promise<void> {
    const match = this.duplicate();
    if (!match || this.busy()) return;

    this.busy.set(true);
    this.error.set(null);

    try {
      await this.tickets.upvote(match.id);
      this.backed.set(match.ticket_number);
      this.duplicate.set(null);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not add your upvote.');
      this.duplicate.set(null);
    } finally {
      this.busy.set(false);
    }
  }

  /** "Mine is different" — the citizen overrules the proximity guess. */
  protected async fileAnyway(): Promise<void> {
    this.duplicate.set(null);
    this.busy.set(true);

    try {
      await this.createTicket();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not file the report.');
    } finally {
      this.busy.set(false);
    }
  }

  private async createTicket(): Promise<void> {
    const imageUrl = await this.media.upload(this.photo!, 'reports');

    const ticket = await this.tickets.create({
      category: this.category,
      urgency: this.urgency,
      ward_location: this.wardLocation.trim(),
      description: this.description().trim().slice(0, DESCRIPTION_LIMIT) || null,
      image_url: imageUrl,
      latitude: this.latitude(),
      longitude: this.longitude(),
      department_email: this.departmentEmail.trim() || null,
    });

    this.filed.set(ticket);
  }

  protected fileAnother(): void {
    this.filed.set(null);
    this.description.set('');
    this.photo = null;

    const preview = this.previewUrl();
    if (preview) URL.revokeObjectURL(preview);
    this.previewUrl.set(null);
  }
}
