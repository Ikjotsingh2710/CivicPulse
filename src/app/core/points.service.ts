import { Injectable } from '@angular/core';

import { supabase } from './supabase.client';
import { describeSupabaseError } from './supabase.errors';
import type { PulsePointEvent, Redemption, RedemptionResult, Reward } from './models';

/**
 * Pulse Points — reading the ledger and spending from it.
 *
 * There is no `award()` method here, and there could not be one: the browser
 * has no INSERT policy on `pulse_points`. Points appear only when the database
 * trigger sees a ward desk approve a campus report. Everything this service can
 * do is read what the server decided, plus call one function to spend it.
 */
@Injectable({ providedIn: 'root' })
export class PointsService {
  /**
   * The balance, summed by Postgres rather than here.
   *
   * Summing client-side would mean trusting a number the client computed, and
   * would quietly go wrong the moment the ledger grew past one page of rows.
   */
  async balance(): Promise<number> {
    const { data, error } = await supabase.rpc('pulse_balance');
    if (error) throw new Error(describeSupabaseError(error, 'Could not load your balance.'));
    return (data as number | null) ?? 0;
  }

  /** Every award and spend, newest first. RLS limits this to the caller's own. */
  async ledger(): Promise<PulsePointEvent[]> {
    const { data, error } = await supabase
      .from('pulse_points')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(describeSupabaseError(error, 'Could not load your points history.'));
    return (data ?? []) as PulsePointEvent[];
  }

  async rewards(): Promise<Reward[]> {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('active', true)
      .order('sort');

    if (error) throw new Error(describeSupabaseError(error, 'Could not load the rewards.'));
    return (data ?? []) as Reward[];
  }

  async redemptions(): Promise<Redemption[]> {
    const { data, error } = await supabase
      .from('redemptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(describeSupabaseError(error, 'Could not load your rewards.'));
    return (data ?? []) as Redemption[];
  }

  /**
   * Spends points on a reward.
   *
   * The balance check, the code claim, the redemption row and the deduction all
   * happen inside one Postgres function, so there is no sequence of client
   * calls that could spend points without issuing a reward or vice versa. A
   * refusal — not enough points, reward withdrawn — comes back as an error
   * raised by that function, which is why the message is surfaced as-is.
   */
  async redeem(rewardKey: string): Promise<RedemptionResult> {
    const { data, error } = await supabase.rpc('redeem_reward', { p_reward_key: rewardKey });

    if (error) {
      // Postgres RAISE messages are written for the citizen ("This reward costs
      // 50 Pulse Points and you have 35"), so they are better than any generic
      // fallback we could substitute.
      throw new Error(error.message || 'Could not redeem that reward.');
    }

    return data as RedemptionResult;
  }
}
