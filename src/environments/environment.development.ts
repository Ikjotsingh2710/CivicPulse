/**
 * Development environment. Same browser-safe rules as `environment.ts` —
 * never put the Supabase secret (service-role) key in this directory.
 */
export const environment = {
  production: false,

  supabaseUrl: 'https://nzrehjoqtlqapdeujhso.supabase.co',
  supabasePublishableKey: 'sb_publishable_UBbcHnqlXrheQUxTdfSXYQ_-KH_yAUY',

  // Must match environment.ts — this string is the auth identity. See the note there.
  authEmailDomain: 'citizens.civicpulse.app',

  cloudinary: {
    cloudName: '',
    unsignedPreset: '',
  },
};
