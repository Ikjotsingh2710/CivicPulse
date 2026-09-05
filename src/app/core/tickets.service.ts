import { Injectable, inject } from '@angular/core';

import { supabase } from './supabase.client';
import { AuthService } from './auth.service';
import { MediaService } from './media.service';
import { describeSupabaseError } from './supabase.errors';
import { COARSE_FIX_METRES } from './geolocate';
import type {
  DuplicateMatch,
  GrievanceTicket,
  NewGrievanceTicket,
  PublicTicket,
  TicketStatus,
} from './models';

export interface AdminTicketFilters {
  status?: TicketStatus;
  urgency?: string;
  category?: string;
  wardLocation?: string;
  /** ISO date (yyyy-mm-dd); matches tickets created on or after this day. */
  submittedFrom?: string;
}

@Injectable({ providedIn: 'root' })
export class TicketsService {
  private readonly auth = inject(AuthService);
  private readonly media = inject(MediaService);

  /**
   * The citizen's own tickets. The `eq` below is a convenience for the query
   * planner only - RLS is what actually guarantees the scoping, so a tampered
   * client still cannot widen the result set.
   */
  async listMine(): Promise<GrievanceTicket[]> {
    const phone = this.auth.phone();
    if (!phone) return [];

    const { data, error } = await supabase
      .from('grievance_tickets')
      .select('*')
      .eq('user_phone', phone)
      .order('created_at', { ascending: false });

    if (error) throw new Error(describeSupabaseError(error, 'Could not load your tickets.'));
    return (data ?? []) as GrievanceTicket[];
  }

  /**
   * Counts for the profile panel. Fetches only the status column and tallies
   * locally — one round trip instead of one query per bucket.
   */
  async myCounts(): Promise<{ active: number; resolved: number }> {
    const phone = this.auth.phone();
    if (!phone) return { active: 0, resolved: 0 };

    const { data, error } = await supabase
      .from('grievance_tickets')
      .select('status')
      .eq('user_phone', phone);

    if (error) throw new Error(describeSupabaseError(error, 'Could not load your totals.'));

    // A rejected ticket is closed, not active — counting it as outstanding
    // would leave the citizen chasing something nobody is working on.
    const rows = (data ?? []) as { status: TicketStatus }[];
    return {
      active: rows.filter((row) => row.status !== 'Resolved' && row.status !== 'Rejected').length,
      resolved: rows.filter((row) => row.status === 'Resolved').length,
    };
  }

  async getByNumber(ticketNumber: string): Promise<GrievanceTicket | null> {
    const { data, error } = await supabase
      .from('grievance_tickets')
      .select('*')
      .eq('ticket_number', ticketNumber)
      .maybeSingle<GrievanceTicket>();

    if (error) throw new Error(describeSupabaseError(error, 'Could not load that ticket.'));
    return data ?? null;
  }

  /** Files a new ticket. `ticket_number` is assigned by a Postgres trigger. */
  async create(
    ticket: Omit<NewGrievanceTicket, 'user_phone' | 'user_name'>,
  ): Promise<GrievanceTicket> {
    const phone = this.auth.phone();
    if (!phone) throw new Error('Sign in before filing a report.');

    const { data, error } = await supabase
      .from('grievance_tickets')
      .insert({ ...ticket, user_phone: phone, user_name: this.auth.fullName() || null })
      .select('*')
      .single<GrievanceTicket>();

    if (error) throw new Error(describeSupabaseError(error, 'Could not file the report.'));
    return data;
  }

  /**
   * The public feed for a region — everybody's reports, not just your own.
   *
   * Reads the `public_tickets` view rather than the table. The view is the
   * privacy boundary: it publishes the reporter's name and withholds their
   * phone number, and it runs as its owner so it can show one citizen another
   * citizen's report without opening up the underlying table.
   *
   * Matches on two things, because `ward_location` holds whichever the reporter
   * picked from the capsule — a campus name OR a city name:
   *
   *   1. the campuses whose city or pincode matched the search, by exact name;
   *   2. the search term itself, case-insensitively, so a report filed against
   *      "New Delhi" is found by "new delhi", "Delhi" and "delhi" alike.
   *
   * Without the second, every city-filed report was invisible to search — the
   * only names ever looked for were the institutions'.
   *
   * Two queries rather than one `or()`: campus names contain em-dashes and
   * commas that PostgREST's inline filter grammar does not survive intact.
   */
  async listPublicByRegion(term: string, wards: readonly string[]): Promise<PublicTicket[]> {
    const needle = term.trim();
    const select = () => supabase.from('public_tickets').select('*');

    const requests: PromiseLike<{ data: unknown; error: unknown }>[] = [];

    if (needle) {
      // `%` around the term, and `ilike` so capitalisation never hides a report.
      requests.push(select().ilike('ward_location', `%${needle}%`));
    }

    if (wards.length > 0) {
      requests.push(select().in('ward_location', wards as string[]));
    }

    // No search at all — someone opened /issues directly. Showing the most
    // recent reports everywhere beats an empty page that looks broken.
    if (requests.length === 0) {
      const { data, error } = await select()
        .order('upvote_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw new Error(describeSupabaseError(error, 'Could not load reports.'));
      return (data ?? []) as PublicTicket[];
    }

    const results = await Promise.all(requests);

    const failure = results.find((result) => result.error);
    if (failure) {
      throw new Error(describeSupabaseError(failure.error as never, 'Could not search that region.'));
    }

    // A report can satisfy both queries, so dedupe on id before sorting.
    const byId = new Map<string, PublicTicket>();
    for (const result of results) {
      for (const row of (result.data ?? []) as PublicTicket[]) byId.set(row.id, row);
    }

    // Most-supported first: that is the whole point of upvoting.
    return [...byId.values()].sort(
      (a, b) =>
        b.upvote_count - a.upvote_count ||
        Date.parse(b.created_at) - Date.parse(a.created_at),
    );
  }

  /**
   * Looks for an open report of the same category within 75m.
   *
   * Skipped entirely when there is no geotag, or when the fix is too coarse to
   * distinguish 75 metres.
   *
   * Advisory: the answer is shown to the citizen, who decides whether it is
   * really the same problem. Returns null when the draft has no geotag, since
   * proximity is the only signal worth trusting here.
   */
  async findDuplicate(
    category: string,
    latitude: number | null,
    longitude: number | null,
    accuracyMetres: number | null = null,
  ): Promise<DuplicateMatch | null> {
    if (latitude === null || longitude === null) return null;

    // A cell-tower fix can be kilometres wide, which would place unrelated
    // reports at nearly the same coordinates and flag them as duplicates of
    // each other. If the fix cannot resolve 75 metres, it cannot answer the
    // question, so it is not asked.
    if (accuracyMetres !== null && accuracyMetres > COARSE_FIX_METRES) return null;

    const { data, error } = await supabase.rpc('find_duplicate_ticket', {
      p_category: category,
      p_lat: latitude,
      p_lng: longitude,
    });

    // A failed duplicate check must never block a report — the worst case is a
    // duplicate that someone has to merge by hand later.
    if (error) return null;
    return (data as DuplicateMatch | null) ?? null;
  }

  /** Adds the caller's upvote. The server decides whether it is allowed. */
  async upvote(ticketId: string): Promise<void> {
    const { error } = await supabase
      .from('ticket_upvotes')
      .insert({ ticket_id: ticketId, user_phone: this.auth.phone() });

    if (error) {
      if (error.code === '23505') throw new Error('You have already upvoted this report.');
      // The guard trigger's messages are written for the citizen.
      throw new Error(error.message || 'Could not add your upvote.');
    }
  }

  async removeUpvote(ticketId: string): Promise<void> {
    const { error } = await supabase.from('ticket_upvotes').delete().eq('ticket_id', ticketId);
    if (error) throw new Error(describeSupabaseError(error, 'Could not remove your upvote.'));
  }

  /** Which reports the caller has already upvoted, so buttons show their state. */
  async myUpvotedIds(): Promise<Set<string>> {
    if (!this.auth.phone()) return new Set();

    const { data, error } = await supabase.from('ticket_upvotes').select('ticket_id');
    if (error) return new Set();

    return new Set((data ?? []).map((row) => (row as { ticket_id: string }).ticket_id));
  }

  /** Admin feed. Visible rows come from the `admin_all_tickets` policy. */
  async listForAdmin(filters: AdminTicketFilters = {}): Promise<GrievanceTicket[]> {
    let query = supabase.from('grievance_tickets').select('*');

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.urgency) query = query.eq('urgency', filters.urgency);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.wardLocation) query = query.eq('ward_location', filters.wardLocation);
    if (filters.submittedFrom) query = query.gte('created_at', filters.submittedFrom);

    // Most-upvoted first, then newest. Without this a problem affecting fifty
    // people slides down the queue every time somebody files anything newer.
    const { data, error } = await query
      .order('upvote_count', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw new Error(describeSupabaseError(error, 'Could not load the feed.'));
    return (data ?? []) as GrievanceTicket[];
  }

  /** Admin-only: rejected by RLS for anyone outside `admin_users`. */
  async updateStatus(id: string, status: TicketStatus): Promise<GrievanceTicket> {
    const { data, error } = await supabase
      .from('grievance_tickets')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single<GrievanceTicket>();

    if (error) throw new Error(describeSupabaseError(error, 'Status update failed.'));
    return data;
  }

  /**
   * Admin-only: closes a ticket as not actionable, with a reason the citizen
   * will read. Sent in one PATCH so a ticket can never be left rejected with no
   * explanation — the two columns move together or not at all.
   */
  async reject(id: string, reason: string): Promise<GrievanceTicket> {
    const trimmed = reason.trim();
    if (!trimmed) throw new Error('Give a reason before rejecting a report.');

    const { data, error } = await supabase
      .from('grievance_tickets')
      .update({ status: 'Rejected', rejection_reason: trimmed })
      .eq('id', id)
      .select('*')
      .single<GrievanceTicket>();

    if (error) throw new Error(describeSupabaseError(error, 'Could not reject the report.'));

    // Rejecting used to leave the photo in public storage for ever, which made
    // the button useless against the thing it exists for. The status change is
    // already committed above, so a failure here leaves a rejected report with
    // an orphaned file — recoverable — rather than a report nobody could close.
    if (data.image_url) void this.media.remove(data.image_url);

    return data;
  }

  /**
   * Admin-only: re-files a report under the right category.
   *
   * The common failure is a genuine issue with the wrong label — garbage filed
   * as a pothole. Correcting it keeps a real report that the desk can act on,
   * where rejecting it would throw away a citizen's valid contribution.
   */
  async updateCategory(id: string, category: string): Promise<GrievanceTicket> {
    const { data, error } = await supabase
      .from('grievance_tickets')
      .update({ category })
      .eq('id', id)
      .select('*')
      .single<GrievanceTicket>();

    if (error) throw new Error(describeSupabaseError(error, 'Could not change the category.'));
    return data;
  }

  /**
   * Admin-only: removes a report and its photographs for good.
   *
   * The normal way to close a bad report is `reject()`, which keeps the record
   * so the citizen can read why. This is the rarer case — content that should
   * not remain on the record at all — and it is irreversible.
   *
   * Files go first, because once the row is deleted nothing knows their paths.
   * If a file delete fails the row is still removed, and the orphan is inert:
   * the storage policy grants access only to an object some report still points
   * at, so a file with no report is unreadable by everyone.
   */
  async deleteForever(ticket: GrievanceTicket): Promise<void> {
    const files = [ticket.image_url, ticket.resolution_image_url].filter(
      (value): value is string => Boolean(value),
    );

    await Promise.all(files.map((file) => this.media.remove(file)));

    const { error } = await supabase.from('grievance_tickets').delete().eq('id', ticket.id);
    if (error) throw new Error(describeSupabaseError(error, 'Could not delete the report.'));
  }

  /** Admin-only: attaches the "after" resolution proof photo. */
  async attachResolutionPhoto(id: string, url: string): Promise<GrievanceTicket> {
    const { data, error } = await supabase
      .from('grievance_tickets')
      .update({ resolution_image_url: url })
      .eq('id', id)
      .select('*')
      .single<GrievanceTicket>();

    if (error) throw new Error(describeSupabaseError(error, 'Proof upload failed.'));
    return data;
  }
}
