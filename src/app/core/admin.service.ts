import { Injectable } from '@angular/core';

import { supabase } from './supabase.client';
import { describeSupabaseError } from './supabase.errors';
import type { PlatformFeedback, Profile, TicketStatus } from './models';

/**
 * Everything the control desk reads that is not a grievance ticket.
 *
 * Nothing here is privileged by virtue of living in this file — each query is
 * an ordinary anon-key request that RLS widens for a caller who has a row in
 * `admin_users`. A citizen calling these methods gets their own row or an empty
 * list, never an error, which is exactly what the policies say should happen.
 * The service-role key is never involved; it must never reach the browser.
 */

/** Cross-table totals for the overview strip. */
export interface AdminOverview {
  tickets: number;
  submitted: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  /** Still open and filed more than 24h ago — the backlog worth looking at. */
  stale: number;
  citizens: number;
  feedback: number;
  badFeedback: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AdminService {
  /**
   * Platform feedback, newest first. Complaints about CivicPulse itself, as
   * opposed to grievance tickets, which are complaints about the city.
   */
  async listFeedback(): Promise<PlatformFeedback[]> {
    const { data, error } = await supabase
      .from('platform_feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(describeSupabaseError(error, 'Could not load feedback.'));
    return (data ?? []) as PlatformFeedback[];
  }

  /** Every registered citizen. Identity only — passwords live in `auth.users`. */
  async listCitizens(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(describeSupabaseError(error, 'Could not load citizens.'));
    return (data ?? []) as Profile[];
  }

  /**
   * How many tickets each phone number has filed, and how many are still open.
   * Fetches two columns for the whole table and tallies here, because Postgrest
   * cannot group without a database view and this dataset is small.
   */
  async ticketCountsByPhone(): Promise<Map<string, { total: number; open: number }>> {
    const { data, error } = await supabase.from('grievance_tickets').select('user_phone,status');
    if (error) throw new Error(describeSupabaseError(error, 'Could not load ticket totals.'));

    const counts = new Map<string, { total: number; open: number }>();
    for (const row of (data ?? []) as { user_phone: string; status: TicketStatus }[]) {
      const entry = counts.get(row.user_phone) ?? { total: 0, open: 0 };
      entry.total += 1;
      if (row.status !== 'Resolved' && row.status !== 'Rejected') entry.open += 1;
      counts.set(row.user_phone, entry);
    }

    return counts;
  }

  /**
   * One number per tile. Three narrow `select`s beat six `count` round trips,
   * and the rows are small enough that tallying in the browser is cheaper than
   * asking Postgres for each bucket separately.
   */
  async overview(): Promise<AdminOverview> {
    const [tickets, profiles, feedback] = await Promise.all([
      supabase.from('grievance_tickets').select('status,created_at'),
      supabase.from('profiles').select('id'),
      supabase.from('platform_feedback').select('sentiment'),
    ]);

    if (tickets.error) {
      throw new Error(describeSupabaseError(tickets.error, 'Could not load totals.'));
    }

    const rows = (tickets.data ?? []) as { status: TicketStatus; created_at: string }[];
    const cutoff = Date.now() - DAY_MS;
    const countOf = (status: TicketStatus) => rows.filter((row) => row.status === status).length;

    // The feedback and profiles tables are optional migrations (0003 / 0004).
    // A project that has not run them should still get a working overview
    // rather than an error, so those two failures degrade to zero.
    const sentiments = (feedback.error ? [] : (feedback.data ?? [])) as {
      sentiment: string | null;
    }[];

    return {
      tickets: rows.length,
      submitted: countOf('Submitted'),
      inProgress: countOf('In Progress'),
      resolved: countOf('Resolved'),
      rejected: countOf('Rejected'),
      // Closed tickets of either kind are not a backlog.
      stale: rows.filter(
        (row) =>
          row.status !== 'Resolved' &&
          row.status !== 'Rejected' &&
          Date.parse(row.created_at) < cutoff,
      ).length,
      citizens: profiles.error ? 0 : (profiles.data ?? []).length,
      feedback: sentiments.length,
      badFeedback: sentiments.filter((row) => row.sentiment === 'Bad').length,
    };
  }
}
