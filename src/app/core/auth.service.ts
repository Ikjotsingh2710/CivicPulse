import { Injectable, computed, signal } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';

import { environment } from '../../environments/environment';
import { supabase } from './supabase.client';
import type { AdminUser, CitizenProfile, Credentials, Registration } from './models';

/**
 * Reduces anything a person might type to the one canonical form that is this
 * system's identity key: it is the local part of the synthetic auth email, the
 * `phone` claim in user metadata, `grievance_tickets.user_phone`, and
 * `admin_users.phone`. Keeping one representation everywhere is what makes the
 * RLS comparison `user_phone = current_phone()` reliable.
 *
 * Stripping non-digits is not enough on its own. `+91 74288 92131`,
 * `074288 92131` and `7428892131` are one person writing one number, but as raw
 * digit strings they are three different identities — three accounts, three
 * sets of tickets, and no way to see any of them from the others. So the
 * Indian trunk and country prefixes are removed to leave the bare subscriber
 * number.
 *
 * Only the +91 prefix is unwound, because that is the only country this app
 * serves and a blind "strip the first two digits" rule would corrupt genuine
 * foreign numbers. Anything that is not recognisably Indian is left exactly as
 * typed, so it still round-trips consistently even if it is not canonicalised.
 */
export function normalisePhone(raw: string): string {
  const digits = (raw ?? '').replace(/\D+/g, '');

  // 917428892131 → 7428892131 (country code, with or without the 00/0 trunk).
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3);
  if (digits.length === 14 && digits.startsWith('0091')) return digits.slice(4);

  // 07428892131 → 7428892131 (domestic trunk prefix).
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);

  return digits;
}

/**
 * Presentation only — the digits are what identity and RLS run on, never this.
 * Ten digits are assumed Indian; anything else is grouped loosely so foreign
 * numbers still read as phone numbers rather than as one long run.
 */
export function formatPhone(digits: string | null): string {
  if (!digits) return '';

  const value = normalisePhone(digits);
  if (value.length === 10) return `+91 ${value.slice(0, 5)} ${value.slice(5)}`;
  if (value.length === 12 && value.startsWith('91')) {
    return `+91 ${value.slice(2, 7)} ${value.slice(7)}`;
  }

  return `+${value.slice(0, value.length - 10)} ${value.slice(-10, -5)} ${value.slice(-5)}`.trim();
}

export class AuthError extends Error {}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionSignal = signal<Session | null>(null);
  private readonly adminRowSignal = signal<AdminUser | null>(null);
  private readonly readySignal = signal(false);

  /** True once the persisted session has been restored — guards wait on this. */
  readonly ready = this.readySignal.asReadonly();
  readonly session = this.sessionSignal.asReadonly();

  readonly user = computed<User | null>(() => this.sessionSignal()?.user ?? null);
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);

  readonly profile = computed<CitizenProfile | null>(() => {
    const meta = this.user()?.user_metadata as Partial<CitizenProfile> | undefined;
    if (!meta?.phone) return null;
    return { full_name: meta.full_name ?? '', phone: meta.phone };
  });

  readonly phone = computed(() => this.profile()?.phone ?? null);
  readonly fullName = computed(() => this.profile()?.full_name ?? '');

  readonly adminRow = this.adminRowSignal.asReadonly();
  readonly isAdmin = computed(() => this.adminRowSignal() !== null);

  private readonly restored: Promise<void>;

  constructor() {
    this.restored = supabase.auth.getSession().then(async ({ data }) => {
      this.sessionSignal.set(data.session);
      await this.refreshAdminRow();
      this.readySignal.set(true);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      this.sessionSignal.set(session);
      void this.refreshAdminRow();
    });
  }

  /** Resolves once the session has been read back from storage. */
  whenReady(): Promise<void> {
    return this.restored;
  }

  /**
   * Supabase Auth needs an email address, but citizens only ever type a phone
   * number. The address is derived, never shown, and never delivered to — the
   * domain is non-routable on purpose.
   */
  emailForPhone(phone: string): string {
    return `${normalisePhone(phone)}@${environment.authEmailDomain}`;
  }

  async register({ fullName, phone, password }: Registration): Promise<void> {
    const digits = normalisePhone(phone);
    this.assertPhone(digits);
    if (!fullName.trim()) throw new AuthError('Enter your full name.');
    this.assertPassword(password);

    const { data, error } = await supabase.auth.signUp({
      email: this.emailForPhone(digits),
      password,
      options: { data: { full_name: fullName.trim(), phone: digits } },
    });

    if (error) throw new AuthError(this.humanise(error.message));

    // With "Confirm email" still enabled in the dashboard, sign-up succeeds but
    // hands back no session and the confirmation mail goes nowhere, because the
    // address is synthetic. Fail loudly rather than leaving a dead account.
    if (!data.session) {
      throw new AuthError(
        'Account created but no session was issued. Turn off "Confirm email" in ' +
          'Supabase → Authentication → Sign In / Providers → Email, then sign in.',
      );
    }

    await this.refreshAdminRow();
  }

  async signIn({ phone, password }: Credentials): Promise<void> {
    const digits = normalisePhone(phone);
    this.assertPhone(digits);

    const { error } = await supabase.auth.signInWithPassword({
      email: this.emailForPhone(digits),
      password,
    });

    if (error) throw new AuthError(this.humanise(error.message));
    await this.refreshAdminRow();
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    this.adminRowSignal.set(null);
  }

  /**
   * Re-checks the current password before changing it. Supabase does not
   * require the old password for an authenticated update, which would let
   * anyone at an unlocked screen take the account over.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const phone = this.phone();
    if (!phone) throw new AuthError('You are not signed in.');
    this.assertPassword(newPassword);

    if (currentPassword === newPassword) {
      throw new AuthError('The new password must be different from the current one.');
    }

    const { error: checkError } = await supabase.auth.signInWithPassword({
      email: this.emailForPhone(phone),
      password: currentPassword,
    });

    if (checkError) throw new AuthError('Your current password is not correct.');

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new AuthError(this.humanise(error.message));
  }

  /**
   * Looks the caller up in `admin_users`. RLS only returns the caller's own
   * row, so a citizen always reads back nothing — the check cannot be spoofed
   * from the client.
   */
  async refreshAdminRow(): Promise<AdminUser | null> {
    const phone = this.phone();
    if (!phone) {
      this.adminRowSignal.set(null);
      return null;
    }

    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle<AdminUser>();

    const row = error ? null : (data ?? null);
    this.adminRowSignal.set(row);
    return row;
  }

  private assertPhone(digits: string): void {
    if (digits.length < 10 || digits.length > 15) {
      throw new AuthError('Enter a valid phone number (10–15 digits).');
    }
  }

  private assertPassword(password: string): void {
    if (password.length < 6) throw new AuthError('Password must be at least 6 characters.');
  }

  /** Supabase reports auth failures in email terms; the user only sees a phone. */
  private humanise(message: string): string {
    if (/invalid login credentials/i.test(message)) return 'Wrong phone number or password.';
    if (/user already registered/i.test(message)) {
      return 'That phone number is already registered — sign in instead.';
    }
    // Supabase's validator rejects reserved TLDs (.local, .test, .invalid).
    if (/email address .* invalid/i.test(message)) {
      return `Supabase rejected the derived address at "${environment.authEmailDomain}". ` +
        'Set environment.authEmailDomain to a real public TLD.';
    }
    // Sign-up sends a confirmation mail while "Confirm email" is on, and the
    // built-in SMTP allows only a couple per hour — so the toggle shows up here
    // as a rate limit rather than as anything about email.
    if (/rate limit|too many requests/i.test(message)) {
      return 'Supabase is rate-limiting sign-ups because it is still trying to send ' +
        'confirmation emails. Turn off "Confirm email" in Authentication → Sign In / ' +
        'Providers → Email, then wait a few minutes and retry.';
    }
    return message;
  }
}
