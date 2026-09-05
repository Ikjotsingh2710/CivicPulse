import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '../../core/admin.service';
import { downloadCsv } from './csv';
import type { PlatformFeedback } from '../../core/models';

/**
 * Platform feedback — what people say about CivicPulse itself, which is a
 * different thing from a grievance ticket. Signed-out visitors can leave it, so
 * the identity columns are frequently empty and the `page` column is often the
 * only clue about what they were doing.
 *
 * Read-only by design: migration 0003 grants admins SELECT and nothing else, so
 * there is no reply or delete action to offer here.
 */
@Component({
  selector: 'cp-admin-feedback',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="bar">
      <div class="field inline">
        <label for="f-sentiment">Sentiment</label>
        <select id="f-sentiment" [(ngModel)]="sentiment">
          <option value="">Any</option>
          <option value="Good">Good</option>
          <option value="Okay">Okay</option>
          <option value="Bad">Bad</option>
        </select>
      </div>

      <p class="muted">{{ visible().length }} of {{ rows().length }}</p>

      <button
        type="button"
        class="btn-ghost"
        (click)="exportCsv()"
        [disabled]="visible().length === 0"
      >
        Export CSV
      </button>
    </div>

    @if (error(); as message) {
      <p class="alert alert-error" role="alert">{{ message }}</p>
    }

    @if (loading()) {
      <p class="muted">Loading feedback…</p>
    } @else if (visible().length === 0) {
      <p class="muted">No feedback yet.</p>
    } @else {
      <div class="list">
        @for (row of visible(); track row.id) {
          <article class="card entry">
            <div class="top">
              @if (row.sentiment) {
                <span class="pill" [class]="pill(row.sentiment)">{{ row.sentiment }}</span>
              } @else {
                <span class="pill pill-submitted">No rating</span>
              }
              <span class="muted when">{{ row.created_at | date: 'd MMM y, h:mm a' }}</span>
            </div>

            <p class="message">{{ row.message }}</p>

            <p class="muted who">
              {{ row.user_name || 'Anonymous' }}
              @if (row.user_phone) {
                · {{ row.user_phone }}
              }
              @if (row.page) {
                · from <code>{{ row.page }}</code>
              }
            </p>
          </article>
        }
      </div>
    }
  `,
  styles: `
    .bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }

    .bar p {
      margin: 0;
    }

    .field.inline {
      flex-direction: row;
      align-items: center;
      gap: 8px;
      margin-bottom: 0;
    }

    .list {
      display: grid;
      gap: 12px;
    }

    .top {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .when {
      font-size: 0.8rem;
    }

    .message {
      margin: 0 0 8px;
      color: var(--ink-strong);
    }

    .who {
      margin: 0;
      font-size: 0.82rem;
    }

    code {
      font-size: 0.78rem;
      background: var(--surface-sunken);
      padding: 1px 5px;
      border-radius: 5px;
    }
  `,
})
export class AdminFeedback {
  private readonly service = inject(AdminService);

  protected sentiment = signal('');
  protected readonly rows = signal<PlatformFeedback[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  /** Filtered in the browser: the whole table is one small request. */
  protected readonly visible = computed(() => {
    const wanted = this.sentiment();
    if (!wanted) return this.rows();
    return this.rows().filter((row) => row.sentiment === wanted);
  });

  constructor() {
    void this.reload();
  }

  protected pill(sentiment: string): string {
    if (sentiment === 'Good') return 'pill-resolved';
    if (sentiment === 'Bad') return 'pill-high';
    return 'pill-progress';
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.rows.set(await this.service.listFeedback());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not load feedback.');
    } finally {
      this.loading.set(false);
    }
  }

  protected exportCsv(): void {
    downloadCsv(
      'civicpulse-feedback',
      ['Received', 'Sentiment', 'Name', 'Phone', 'Page', 'Message'],
      this.visible().map((row) => [
        row.created_at,
        row.sentiment,
        row.user_name,
        row.user_phone,
        row.page,
        row.message,
      ]),
    );
  }
}
