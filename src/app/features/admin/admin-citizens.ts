import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '../../core/admin.service';
import { formatPhone } from '../../core/auth.service';
import { downloadCsv } from './csv';
import type { Profile } from '../../core/models';

/**
 * The registered-citizen roster, from `public.profiles`.
 *
 * This is identity only. Passwords, sessions and email confirmation live in
 * `auth.users`, which no browser client can reach — there is nothing to show
 * here even for an admin, and nothing on this screen can change an account.
 */
@Component({
  selector: 'cp-admin-citizens',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="bar">
      <div class="field inline">
        <label for="c-search">Search</label>
        <input id="c-search" [(ngModel)]="term" placeholder="Name or phone" />
      </div>

      <p class="muted">{{ visible().length }} of {{ rows().length }} registered</p>

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
      <p class="muted">Loading citizens…</p>
    } @else if (visible().length === 0) {
      <p class="muted">No citizens match that search.</p>
    } @else {
      <div class="card wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th class="num">Reports</th>
              <th class="num">Open</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody>
            @for (row of visible(); track row.id) {
              <tr>
                <td>{{ row.full_name || '—' }}</td>
                <td class="mono">{{ display(row.phone) }}</td>
                <td class="num">{{ countFor(row.phone).total }}</td>
                <td class="num">
                  @if (countFor(row.phone).open > 0) {
                    <span class="pill pill-progress">{{ countFor(row.phone).open }}</span>
                  } @else {
                    0
                  }
                </td>
                <td>{{ row.created_at | date: 'd MMM y' }}</td>
              </tr>
            }
          </tbody>
        </table>
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

    .wrap {
      overflow-x: auto;
      padding: 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    th,
    td {
      text-align: left;
      padding: 11px 16px;
      border-bottom: 1px solid var(--line);
      white-space: nowrap;
    }

    th {
      font-family: var(--font-display);
      font-size: 0.76rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ink-muted);
      background: var(--surface-sunken);
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .num {
      text-align: right;
    }

    .mono {
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class AdminCitizens {
  private readonly service = inject(AdminService);

  protected term = signal('');
  protected readonly rows = signal<Profile[]>([]);
  protected readonly counts = signal(new Map<string, { total: number; open: number }>());
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly visible = computed(() => {
    const needle = this.term().trim().toLowerCase();
    if (!needle) return this.rows();

    return this.rows().filter((row) => {
      const name = (row.full_name ?? '').toLowerCase();
      return name.includes(needle) || (row.phone ?? '').includes(needle);
    });
  });

  constructor() {
    void this.reload();
  }

  protected display(phone: string | null): string {
    return formatPhone(phone) || '—';
  }

  protected countFor(phone: string | null): { total: number; open: number } {
    if (!phone) return { total: 0, open: 0 };
    return this.counts().get(phone) ?? { total: 0, open: 0 };
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [profiles, counts] = await Promise.all([
        this.service.listCitizens(),
        this.service.ticketCountsByPhone(),
      ]);
      this.rows.set(profiles);
      this.counts.set(counts);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not load citizens.');
    } finally {
      this.loading.set(false);
    }
  }

  protected exportCsv(): void {
    downloadCsv(
      'civicpulse-citizens',
      ['Name', 'Phone', 'Reports', 'Open', 'Registered'],
      this.visible().map((row) => [
        row.full_name,
        row.phone,
        this.countFor(row.phone).total,
        this.countFor(row.phone).open,
        row.created_at,
      ]),
    );
  }
}
