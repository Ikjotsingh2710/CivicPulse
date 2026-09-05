import { DatePipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TicketsService } from '../../core/tickets.service';
import { ESCALATION_HOURS, escalationStatus, type EscalationStatus } from '../../core/escalation';
import type { GrievanceTicket } from '../../core/models';

interface Row {
  ticket: GrievanceTicket;
  status: EscalationStatus;
}

/**
 * Countdown to the next automatic department reminder.
 *
 * The numbers are computed from the same fields the hourly `pg_cron` job reads
 * (`last_escalated_at`, falling back to `created_at`), so what is shown here is
 * what the server will act on rather than a separate client-side guess.
 */
@Component({
  selector: 'cp-escalations-page',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="page">
      <header class="head">
        <div>
          <h1>Ticket escalations</h1>
          <p class="muted">
            Unresolved reports are emailed to the responsible department every
            {{ hours }} hours until someone acts.
          </p>
        </div>
        <a class="btn-ghost link-btn" routerLink="/profile">All complaints</a>
      </header>

      @if (error(); as message) {
        <p class="alert alert-error" role="alert">{{ message }}</p>
      }

      @if (loading()) {
        <p class="muted">Loading escalation status…</p>
      } @else if (rows().length === 0) {
        <div class="card empty">
          <h2>Nothing waiting</h2>
          <p class="muted">
            You have no unresolved reports, so no escalation clocks are running.
          </p>
        </div>
      } @else {
        <div class="list">
          @for (row of rows(); track row.ticket.id) {
            <article class="card row" [class.overdue]="row.status.state === 'overdue'">
              <div class="meta">
                <p class="number">{{ row.ticket.ticket_number }}</p>
                <h2>{{ row.ticket.category }}</h2>
                <p class="muted sub">
                  {{ row.ticket.ward_location }} · filed
                  {{ row.ticket.created_at | date: 'd MMM y' }}
                  @if (row.ticket.department_email) {
                    · {{ row.ticket.department_email }}
                  }
                </p>
              </div>

              <div class="clock">
                @switch (row.status.state) {
                  @case ('pending') {
                    <p class="count">{{ remainingLabel(row.status) }}</p>
                    <p class="muted sub">
                      Next sweep {{ row.status.dueAt | date: 'd MMM, h:mm a' }}
                    </p>
                  }
                  @case ('overdue') {
                    <p class="count due">Due now</p>
                    <p class="muted sub">{{ row.status.label }}</p>
                  }
                  @default {
                    <p class="count muted-count">Not scheduled</p>
                    <p class="muted sub">{{ row.status.label }}</p>
                  }
                }
                @if (row.status.escalated) {
                  <span class="pill pill-progress">Reminder sent</span>
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
      max-width: 54ch;
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

    .list {
      display: grid;
      gap: 14px;
    }

    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }

    .row.overdue {
      border-color: rgba(176, 106, 16, 0.4);
      box-shadow:
        var(--shadow-elevated),
        inset 3px 0 0 var(--warn);
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

    .sub {
      font-size: 0.82rem;
      margin: 0;
    }

    .clock {
      text-align: right;
      min-width: 190px;
    }

    .count {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.32rem;
      letter-spacing: -0.03em;
      color: var(--ink-strong);
      margin: 0 0 2px;
      font-variant-numeric: tabular-nums;
    }

    .count.due {
      color: var(--warn);
    }

    .count.muted-count {
      color: var(--ink-muted);
      font-size: 1.02rem;
    }

    .clock .pill {
      margin-top: 7px;
    }

    .empty {
      text-align: center;
      padding: 44px 22px;
    }
  `,
})
export class EscalationsPage implements OnDestroy {
  private readonly service = inject(TicketsService);

  protected readonly hours = ESCALATION_HOURS;
  protected readonly rows = signal<Row[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  private tickets: GrievanceTicket[] = [];
  private readonly timer: ReturnType<typeof setInterval>;

  constructor() {
    void this.load();
    // A countdown that never moves looks broken; a minute is fine resolution
    // for a job that only runs hourly.
    this.timer = setInterval(() => this.recompute(), 60_000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  protected remainingLabel(status: EscalationStatus): string {
    return status.label.replace(/^(Escalates in|Next reminder in)\s/, '');
  }

  private async load(): Promise<void> {
    try {
      const all = await this.service.listMine();
      this.tickets = all.filter(
      (ticket) => ticket.status !== 'Resolved' && ticket.status !== 'Rejected',
    );
      this.recompute();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not load escalations.');
    } finally {
      this.loading.set(false);
    }
  }

  private recompute(): void {
    const now = Date.now();
    this.rows.set(
      this.tickets.map((ticket) => ({ ticket, status: escalationStatus(ticket, now) })),
    );
  }
}
