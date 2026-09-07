import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { TicketsService } from '../../core/tickets.service';
import { PhotoSrc } from '../../shared/photo-src';
import { PhotoZoom } from '../../shared/photo-zoom';
import type { PublicTicket } from '../../core/models';

/**
 * One report, as a stranger sees it — the page behind a shared link.
 *
 * WHY THIS EXISTS
 *   Upvotes were only reachable by accident. The single way to add your voice
 *   was to try filing the same problem and be told it was a duplicate, which
 *   meant a widely-felt issue only rose up the queue if several people
 *   independently happened to report it. A link lets one person send it to
 *   their street's group and have the rest back it in a tap.
 *
 * WHAT IT SHOWS
 *   `public_tickets`, not the table — so no phone number, and no photo until
 *   the desk has reviewed it. Everything here is already public to anyone who
 *   browses issues by region; the link is just a shorter way to arrive.
 */
@Component({
  selector: 'cp-shared-report-page',
  standalone: true,
  imports: [RouterLink, PhotoSrc, PhotoZoom],
  template: `
    <div class="page narrow">
      @if (loading()) {
        <p class="muted">{{ t('common.loading') }}</p>
      } @else if (ticket(); as report) {
        <article class="card report">
          <p class="number">{{ report.ticket_number }}</p>
          <h1>{{ label('category', report.category) }}</h1>
          <p class="muted meta">{{ report.ward_location }}</p>

          @if (report.description) {
            <p class="body">{{ report.description }}</p>
          }

          @if (report.photo_pending) {
            <!-- Withheld by the view until the desk has looked at it, so that
                 a link cannot be used to publish an unreviewed photo. -->
            <p class="muted pending">{{ t('share.photoPending') }}</p>
          } @else if (report.image_url) {
            <img cpZoom class="photo" [cpPhoto]="report.image_url" [alt]="t('alt.reportedIssue', { category: label('category', report.category) })" />
          }

          <p class="affected">{{ t('share.affected', { count: report.upvote_count + 1 }) }}</p>

          @if (message(); as note) {
            <p class="alert alert-ok" role="status">{{ note }}</p>
          }
          @if (error(); as note) {
            <p class="alert alert-error" role="alert">{{ note }}</p>
          }

          @if (auth.isAuthenticated()) {
            <button
              class="btn-primary wide"
              type="button"
              [disabled]="busy() || backed()"
              (click)="back(report)"
            >
              {{ backed() ? t('share.backed') : busy() ? t('portal.saving') : t('share.meToo') }}
            </button>
          } @else {
            <a class="btn-primary wide link-btn" routerLink="/auth">{{ t('share.signInToBack') }}</a>
          }

          <p class="muted footnote">{{ t('share.footnote') }}</p>
          <a class="btn-ghost wide link-btn" routerLink="/">{{ t('share.reportYourOwn') }}</a>
        </article>
      } @else {
        <div class="card">
          <h1>{{ t('share.notFound') }}</h1>
          <p class="muted">{{ t('share.notFoundSub') }}</p>
          <a class="btn-primary link-btn" routerLink="/">{{ t('share.reportYourOwn') }}</a>
        </div>
      }
    </div>
  `,
  styles: `
    .narrow {
      max-width: 560px;
    }

    .number {
      margin: 0 0 6px;
      font-family: var(--font-display);
      font-size: 0.76rem;
      letter-spacing: 0.1em;
      color: var(--accent-strong);
    }

    .report h1 {
      margin: 0 0 4px;
      font-size: 1.6rem;
      letter-spacing: -0.02em;
    }

    .meta {
      margin: 0;
      font-size: 0.88rem;
    }

    .body {
      margin: 16px 0 0;
    }

    .photo {
      width: 100%;
      margin-top: 16px;
      border-radius: var(--radius);
      border: 1px solid var(--line);
    }

    .pending {
      margin-top: 16px;
      padding: 12px 14px;
      border: 1px dashed var(--line-strong);
      border-radius: var(--radius);
      font-size: 0.88rem;
    }

    .affected {
      margin: 18px 0 14px;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.05rem;
    }

    .wide {
      width: 100%;
      display: block;
      text-align: center;
    }

    .link-btn {
      text-decoration: none;
      padding: 11px 18px;
      border-radius: var(--radius);
      box-sizing: border-box;
    }

    .footnote {
      margin: 14px 0;
      font-size: 0.84rem;
    }
  `,
})
export class SharedReportPage {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t.bind(this.i18n);
  protected readonly label = this.i18n.label.bind(this.i18n);

  protected readonly auth = inject(AuthService);
  private readonly tickets = inject(TicketsService);
  private readonly route = inject(ActivatedRoute);

  protected readonly ticket = signal<PublicTicket | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly backed = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const number = this.route.snapshot.paramMap.get('number');
    if (!number) {
      this.loading.set(false);
      return;
    }

    try {
      this.ticket.set(await this.tickets.getPublicByNumber(number));
    } catch {
      // A missing report and an unreadable one look the same to a visitor, and
      // "we could not find that" is the useful thing to say in both cases.
      this.ticket.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  /** "I have this problem too" — the whole point of the link. */
  protected async back(report: PublicTicket): Promise<void> {
    if (this.busy() || this.backed()) return;

    this.busy.set(true);
    this.error.set(null);

    try {
      await this.tickets.upvote(report.id);
      this.backed.set(true);
      this.message.set(this.t('share.thanks'));

      // Reflect it immediately rather than refetching: the count is the thing
      // the person came here to change, and it should move under their thumb.
      this.ticket.set({ ...report, upvote_count: report.upvote_count + 1 });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : this.t('share.couldNotBack'));
    } finally {
      this.busy.set(false);
    }
  }
}
