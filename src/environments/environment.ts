/**
 * Production environment.
 *
 * Only browser-safe values belong here — this file is compiled into the
 * JavaScript bundle that ships to every visitor. The Supabase *secret*
 * (service-role) key must never appear in this directory; it lives in `.env`
 * and is consumed only by Edge Functions / server-side tooling.
 */
export const environment = {
  production: true,

  supabaseUrl: 'https://nzrehjoqtlqapdeujhso.supabase.co',
  supabasePublishableKey: 'sb_publishable_UBbcHnqlXrheQUxTdfSXYQ_-KH_yAUY',

  /**
   * Supabase Auth is an email/password provider. Citizens authenticate with
   * name + phone + password, so the client synthesises a stable, non-routable
   * address from the phone digits: `9876543210@citizens.civicpulse.app`. The
   * real phone and name are stored in user metadata and are what RLS reads.
   *
   * The TLD must be a real public one — Supabase's validator rejects reserved
   * TLDs such as `.local`, `.test` and `.invalid`. `citizens.civicpulse.app` is
   * an unregistered subdomain, so it is format-valid yet cannot receive mail.
   *
   * CHANGING THIS BREAKS EXISTING LOGINS: the address is the auth identity, so
   * every already-registered citizen would be locked out.
   */
  authEmailDomain: 'citizens.civicpulse.app',

  /**
   * Unsigned Cloudinary upload. Leave `cloudName` empty to fall back to the
   * Supabase Storage bucket `ticket-photos`.
   */
  cloudinary: {
    cloudName: '',
    unsignedPreset: '',
  },
};
