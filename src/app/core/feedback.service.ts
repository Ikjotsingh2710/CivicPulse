import { Injectable, inject } from '@angular/core';

import { supabase } from './supabase.client';
import { AuthService } from './auth.service';
import { describeSupabaseError } from './supabase.errors';

export type Sentiment = 'Good' | 'Okay' | 'Bad';

/** Matches the CHECK constraint in migration 0003. */
export const FEEDBACK_LIMIT = 500;

export interface FeedbackDraft {
  sentiment: Sentiment | null;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly auth = inject(AuthService);

  /**
   * Signed-out visitors can submit too, so the identity columns are optional.
   * Whoever is signed in is attached automatically — nobody is asked to retype
   * their own number to complain about the platform.
   */
  async submit({ sentiment, message }: FeedbackDraft): Promise<void> {
    const trimmed = message.trim().slice(0, FEEDBACK_LIMIT);
    if (!trimmed) throw new Error('Write a line or two before sending.');

    const { error } = await supabase.from('platform_feedback').insert({
      message: trimmed,
      sentiment,
      user_phone: this.auth.phone(),
      user_name: this.auth.fullName() || null,
      page: location.pathname,
    });

    if (error) throw new Error(describeSupabaseError(error, 'Could not send your feedback.'));
  }
}
