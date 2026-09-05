import { Injectable, inject } from '@angular/core';

import { supabase } from './supabase.client';
import { AuthService } from './auth.service';
import { describeSupabaseError } from './supabase.errors';
import type { GrievanceTicket, NewGrievanceTicket, TicketStatus } from './models';

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
   * Region search. RLS decides the breadth: a citizen sees their own tickets in
   * those wards, an admin sees every ticket there. There is no public feed —
   * that would need a policy exposing other people's reports.
   */
  async listByWards(wards: readonly string[]): Promise<GrievanceTicket[]> {
    if (wards.length === 0) return [];

    const { data, error } = await supabase
      .from('grievance_tickets')
      .select('*')
      .in('ward_location', wards as string[])
      .order('created_at', { ascending: false });

    if (error) throw new Error(describeSupabaseError(error, 'Could not search that region.'));
    return (data ?? []) as GrievanceTicket[];
  }

  /** Admin feed. Visible rows come from the `admin_all_tickets` policy. */
  async listForAdmin(filters: AdminTicketFilters = {}): Promise<GrievanceTicket[]> {
    let query = supabase.from('grievance_tickets').select('*');

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.urgency) query = query.eq('urgency', filters.urgency);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.wardLocation) query = query.eq('ward_location', filters.wardLocation);
    if (filters.submittedFrom) query = query.gte('created_at', filters.submittedFrom);

    const { data, error } = await query.order('created_at', { ascending: false });
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
