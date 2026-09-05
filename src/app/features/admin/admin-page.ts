import { Component, inject, signal } from '@angular/core';

import { AdminService, type AdminOverview } from '../../core/admin.service';
import { AuthService } from '../../core/auth.service';
import { AdminCitizens } from './admin-citizens';
import { AdminFeedback } from './admin-feedback';
import { AdminReports } from './admin-reports';

type Tab = 'reports' | 'feedback' | 'citizens';

/**
 * The control desk shell: an overview strip over three tabs.
 *
 * Reaching this component at all means `adminGuard` found a row in
 * `admin_users` for the caller's phone. That guard is a convenience — it keeps
 * citizens from landing on a screen full of empty tables — but it is not the
 * security boundary. RLS is: every query the tabs make is an ordinary anon-key
 * request that the database widens only for a real admin, so forcing the route
 * yields empty lists rather than other people's data.
 *
 * Tabs are lazy: each panel loads its own data in its constructor, so opening
 * the desk costs the overview query plus whichever tab you land on.
 */
@Component({
  selector: 'cp-admin-page',
  standalone: true,
  imports: [AdminReports, AdminFeedback, AdminCitizens],
  template: `
    <div class="page">
      <header class="head">
        <div>
          <h1>Control desk</h1>
          <p class="muted">
            {{ auth.fullName() || auth.phone() }} · {{ auth.adminRow()?.ward_location }}
          </p>
        </div>
      </header>

      @if (overview(); as stats) {
        <section class="stats">
          <button type="button" class="stat" (click)="show('reports')">
            <span class="value">{{ stats.tickets }}</span>
            <span class="label">Total reports</span>
          </button>
          <div class="stat">
            <span class="value">{{ stats.submitted }}</span>
            <span class="label">Submitted</span>
          </div>
          <div class="stat">
            <span class="value">{{ stats.inProgress }}</span>
            <span class="label">In progress</span>
          </div>
          <div class="stat">
            <span class="value">{{ stats.resolved }}</span>
            <span class="label">Resolved</span>
          </div>
          <div class="stat">
            <span class="value">{{ stats.rejected }}</span>
            <span class="label">Rejected</span>
          </div>
          <div class="stat" [class.alarm]="stats.stale > 0">
            <span class="value">{{ stats.stale }}</span>
            <span class="label">Open over 24h</span>
          </div>
          <button type="button" class="stat" (click)="show('citizens')">
            <span class="value">{{ stats.citizens }}</span>
            <span class="label">Citizens</span>
          </button>
          <button type="button" class="stat" (click)="show('feedback')">
            <span class="value">{{ stats.feedback }}</span>
            <span class="label">
              Feedback
              @if (stats.badFeedback > 0) {
                <em>· {{ stats.badFeedback }} bad</em>
              }
            </span>
          </button>
        </section>
      }

      @if (statsError(); as message) {
        <p class="alert alert-error" role="alert">{{ message }}</p>
      }

      <nav class="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="tab() === 'reports'"
          [class.active]="tab() === 'reports'"
          (click)="show('reports')"
        >
          Reports
        </button>
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="tab() === 'feedback'"
          [class.active]="tab() === 'feedback'"
          (click)="show('feedback')"
        >
          Feedback
        </button>
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="tab() === 'citizens'"
          [class.active]="tab() === 'citizens'"
          (click)="show('citizens')"
        >
          Citizens
        </button>
      </nav>

      @switch (tab()) {
        @case ('reports') {
          <cp-admin-reports />
        }
        @case ('feedback') {
          <cp-admin-feedback />
        }
        @case ('citizens') {
          <cp-admin-citizens />
        }
      }
    </div>
  `,
  styles: `
    .head {
      margin-bottom: 20px;
    }

    .head h1 {
      margin-bottom: 2px;
    }

    .head p {
      margin: 0;
    }

    .stats {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
      margin-bottom: 22px;
    }

    .stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
      text-align: left;
      padding: 14px 16px;
      background: var(--surface-elevated);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow-elevated);
      font: inherit;
      color: inherit;
    }

    button.stat {
      cursor: pointer;
      transition: border-color 0.15s ease;
    }

    button.stat:hover {
      border-color: var(--accent);
    }

    button.stat:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    .stat.alarm {
      border-color: var(--danger);
      background: var(--danger-soft);
    }

    .value {
      font-family: var(--font-display);
      font-size: 1.7rem;
      font-weight: 700;
      line-height: 1.1;
      color: var(--ink-strong);
      font-variant-numeric: tabular-nums;
    }

    .label {
      font-size: 0.78rem;
      color: var(--ink-muted);
    }

    .label em {
      font-style: normal;
      color: var(--danger);
      font-weight: 600;
    }

    .tabs {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--line);
      margin-bottom: 20px;
    }

    .tabs button {
      appearance: none;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      padding: 9px 14px;
      font-family: var(--font-display);
      font-size: 0.92rem;
      font-weight: 600;
      color: var(--ink-muted);
      cursor: pointer;
    }

    .tabs button:hover {
      color: var(--ink);
    }

    .tabs button.active {
      color: var(--accent-strong);
      border-bottom-color: var(--accent);
    }

    .tabs button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
  `,
})
export class AdminPage {
  private readonly service = inject(AdminService);
  protected readonly auth = inject(AuthService);

  protected readonly tab = signal<Tab>('reports');
  protected readonly overview = signal<AdminOverview | null>(null);
  protected readonly statsError = signal<string | null>(null);

  constructor() {
    void this.loadOverview();
  }

  protected show(tab: Tab): void {
    this.tab.set(tab);
  }

  private async loadOverview(): Promise<void> {
    try {
      this.overview.set(await this.service.overview());
    } catch (error) {
      this.statsError.set(error instanceof Error ? error.message : 'Could not load totals.');
    }
  }
}
