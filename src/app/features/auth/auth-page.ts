import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../core/auth.service';

type Mode = 'signin' | 'register';

@Component({
  selector: 'cp-auth-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="auth-shell">
      <section class="intro">
        <p class="eyebrow">CivicPulse</p>
        <h1>Report it once.<br />Track it to resolved.</h1>
        <p class="muted">
          Potholes, broken streetlights, waste and water leakage — filed with a photo and a
          location, routed to the ward desk, escalated automatically if nobody acts within 24
          hours.
        </p>
      </section>

      <div class="card panel">
        <div class="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            class="tab"
            [class.active]="mode() === 'signin'"
            [attr.aria-selected]="mode() === 'signin'"
            (click)="setMode('signin')"
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            class="tab"
            [class.active]="mode() === 'register'"
            [attr.aria-selected]="mode() === 'register'"
            (click)="setMode('register')"
          >
            Register
          </button>
        </div>

        @if (error(); as message) {
          <p class="alert alert-error" role="alert">{{ message }}</p>
        }

        <form (ngSubmit)="submit()">
          @if (mode() === 'register') {
            <div class="field">
              <label for="fullName">Full name</label>
              <input
                id="fullName"
                name="fullName"
                autocomplete="name"
                [(ngModel)]="fullName"
                required
              />
            </div>
          }

          <div class="field">
            <label for="phone">Phone number</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputmode="numeric"
              autocomplete="tel"
              placeholder="9876543210"
              [(ngModel)]="phone"
              required
            />
          </div>

          <div class="field">
            <label for="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              [autocomplete]="mode() === 'register' ? 'new-password' : 'current-password'"
              [(ngModel)]="password"
              required
            />
          </div>

          <button class="btn-primary submit" type="submit" [disabled]="busy()">
            {{ busy() ? 'Working…' : mode() === 'register' ? 'Create account' : 'Sign in' }}
          </button>
        </form>

        <p class="muted note">
          No OTP, no email — your phone number is your identity and it never leaves this project.
        </p>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background:
        radial-gradient(1100px 520px at 8% -10%, var(--accent-soft), transparent 60%),
        var(--surface-base);
    }

    .auth-shell {
      max-width: 1040px;
      margin: 0 auto;
      padding: clamp(32px, 7vh, 88px) 20px;
      display: grid;
      gap: 40px;
      grid-template-columns: 1fr;
      align-items: center;
    }

    @media (min-width: 900px) {
      .auth-shell {
        grid-template-columns: 1.1fr 0.9fr;
        gap: 64px;
      }
    }

    .eyebrow {
      font-family: var(--font-display);
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      font-size: 0.72rem;
      color: var(--accent-strong);
      margin: 0 0 14px;
    }

    .intro p.muted {
      max-width: 46ch;
      font-size: 1.02rem;
    }

    .panel {
      box-shadow: var(--shadow-floating);
      padding: 26px;
    }

    .tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      background: var(--surface-sunken);
      border-radius: var(--radius);
      padding: 4px;
      margin-bottom: 20px;
    }

    .tab {
      background: transparent;
      border: none;
      padding: 9px 12px;
      color: var(--ink-muted);
      border-radius: 9px;
    }

    .tab:hover:not(.active) {
      color: var(--ink-strong);
    }

    .tab:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--accent-soft);
    }

    .tab.active {
      background: var(--surface-elevated);
      color: var(--ink-strong);
      box-shadow: var(--shadow-elevated);
    }

    .submit {
      width: 100%;
      margin-top: 6px;
    }

    .note {
      font-size: 0.82rem;
      margin: 16px 0 0;
      text-align: center;
    }
  `,
})
export class AuthPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly mode = signal<Mode>('signin');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected fullName = '';
  protected phone = '';
  protected password = '';

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
    this.error.set(null);
  }

  protected async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    try {
      if (this.mode() === 'register') {
        await this.auth.register({
          fullName: this.fullName,
          phone: this.phone,
          password: this.password,
        });

        // A brand-new account has nothing to return to, so any `redirect` left
        // over from the link they arrived on is ignored: everyone starts at the
        // portal.
        await this.router.navigateByUrl('/');
        return;
      }

      await this.auth.signIn({ phone: this.phone, password: this.password });

      const redirect = this.route.snapshot.queryParamMap.get('redirect');
      await this.router.navigateByUrl(redirect ?? (this.auth.isAdmin() ? '/admin' : '/'));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      this.busy.set(false);
    }
  }
}
