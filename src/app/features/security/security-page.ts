import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService, formatPhone } from '../../core/auth.service';

@Component({
  selector: 'cp-security-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page narrow">
      <header class="head">
        <h1>Security settings</h1>
        <p class="muted">Manage the password on this account and end other sessions.</p>
      </header>

      <section class="card identity">
        <div>
          <p class="label">Signed in as</p>
          <p class="phone">{{ phone() }}</p>
          @if (auth.fullName()) {
            <p class="muted name">{{ auth.fullName() }}</p>
          }
        </div>
        <span class="pill pill-resolved">Active session</span>
      </section>

      <section class="card">
        <h2>Change password</h2>
        <p class="muted lead">
          Your phone number is your username and cannot be changed — it is what every one of
          your reports is filed against.
        </p>

        @if (error(); as message) {
          <p class="alert alert-error" role="alert">{{ message }}</p>
        }
        @if (done()) {
          <p class="alert alert-ok" role="status">Password updated.</p>
        }

        <form (ngSubmit)="submit()">
          <div class="field">
            <label for="current">Current password</label>
            <input
              id="current"
              name="current"
              type="password"
              autocomplete="current-password"
              [ngModel]="current()"
              (ngModelChange)="current.set($event)"
              required
            />
          </div>

          <div class="field">
            <label for="next">New password</label>
            <input
              id="next"
              name="next"
              type="password"
              autocomplete="new-password"
              [ngModel]="next()"
              (ngModelChange)="next.set($event)"
              required
            />
            <span class="muted hint">At least 6 characters.</span>
          </div>

          <div class="field">
            <label for="confirm">Confirm new password</label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autocomplete="new-password"
              [ngModel]="confirm()"
              (ngModelChange)="confirm.set($event)"
              required
            />
          </div>

          <button class="btn-primary" type="submit" [disabled]="busy()">
            {{ busy() ? 'Updating…' : 'Update password' }}
          </button>
        </form>
      </section>

      <section class="card">
        <h2>Sessions</h2>
        <p class="muted lead">
          Signing out everywhere invalidates the token on every device you have used, including
          this one. Use it if you signed in on a shared or lost phone.
        </p>
        <div class="row">
          <a class="btn-ghost link-btn" routerLink="/profile">Back to complaints</a>
          <button class="btn-ghost danger" type="button" (click)="signOutEverywhere()">
            Sign out of all devices
          </button>
        </div>
      </section>
    </div>
  `,
  styles: `
    .narrow {
      max-width: 640px;
    }

    .head {
      margin-bottom: 22px;
    }

    .head h1 {
      margin-bottom: 4px;
    }

    .head p {
      margin: 0;
    }

    .card {
      margin-bottom: 18px;
    }

    .card h2 {
      font-size: 1.12rem;
      margin-bottom: 4px;
    }

    .lead {
      margin: 0 0 18px;
      font-size: 0.9rem;
      max-width: 56ch;
    }

    .identity {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
    }

    .label {
      font-size: 0.71rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-muted);
      font-weight: 600;
      margin: 0 0 4px;
    }

    .phone {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.14rem;
      letter-spacing: -0.02em;
      color: var(--ink-strong);
      margin: 0;
      font-variant-numeric: tabular-nums;
    }

    .name {
      margin: 2px 0 0;
      font-size: 0.86rem;
    }

    .hint {
      font-size: 0.79rem;
    }

    .row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .link-btn {
      display: inline-block;
      text-decoration: none;
      padding: 11px 18px;
      border-radius: var(--radius);
      font-weight: 600;
      color: var(--ink);
    }

    .danger {
      color: var(--danger);
      border-color: rgba(165, 47, 47, 0.3);
    }

    .danger:hover {
      background: var(--danger-soft);
    }
  `,
})
export class SecurityPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly current = signal('');
  protected readonly next = signal('');
  protected readonly confirm = signal('');

  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);

  protected phone(): string {
    return formatPhone(this.auth.phone());
  }

  protected async submit(): Promise<void> {
    if (this.busy()) return;

    if (this.next() !== this.confirm()) {
      this.error.set('The new passwords do not match.');
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    this.done.set(false);

    try {
      await this.auth.changePassword(this.current(), this.next());
      this.done.set(true);
      this.current.set('');
      this.next.set('');
      this.confirm.set('');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not update the password.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async signOutEverywhere(): Promise<void> {
    await this.auth.signOutEverywhere();
    await this.router.navigateByUrl('/auth');
  }
}
