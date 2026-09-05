import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Turns Postgrest/Storage failures into something a person can act on.
 *
 * The setup-shaped failures matter most: an un-applied schema and a missing
 * storage bucket both surface as opaque codes that look like application bugs,
 * and both are fixed by running `supabase/migrations/0001_init.sql`.
 */
export function describeSupabaseError(error: PostgrestError | Error | null, fallback: string): string {
  if (!error) return fallback;

  const code = (error as PostgrestError).code ?? '';
  const message = error.message ?? '';

  if (code === 'PGRST205' || /schema cache/i.test(message)) {
    return 'The database tables do not exist yet. Run supabase/migrations/0001_init.sql in the Supabase SQL Editor.';
  }

  if (code === '42501' || /row-level security/i.test(message)) {
    return 'The database refused this action for your account (row-level security).';
  }

  if (/bucket not found/i.test(message)) {
    return 'The "ticket-photos" storage bucket is missing. Run supabase/migrations/0001_init.sql.';
  }

  if (/failed to fetch|networkerror/i.test(message)) {
    return 'Could not reach Supabase. Check your connection and the project URL.';
  }

  return message || fallback;
}
