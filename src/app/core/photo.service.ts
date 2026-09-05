import { Injectable } from '@angular/core';

import { supabase } from './supabase.client';

const BUCKET = 'ticket-photos';

/** How long a minted URL stays valid. Long enough to browse, short enough that
 *  a link pasted elsewhere stops working the same afternoon. */
const TTL_SECONDS = 60 * 60;

/** Re-mint a little before expiry so a long-open tab never shows a dead image. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * Turns a stored photo reference into something an `<img>` can load.
 *
 * Since migration 0013 the bucket is private, so `image_url` holds an object
 * path rather than an address. A signed URL has to be minted for each one, and
 * the database decides whether the caller is allowed one at all: approved
 * reports are readable by anyone, your own by you, everything by the ward desk.
 * An unreviewed or rejected photo simply cannot be signed.
 *
 * Results are cached, because a feed of forty reports would otherwise mint
 * forty URLs on every render, and each mint is a round trip.
 */
@Injectable({ providedIn: 'root' })
export class PhotoService {
  private readonly cache = new Map<string, { url: string; expires: number }>();
  private readonly inflight = new Map<string, Promise<string | null>>();

  /**
   * Resolves a stored reference to a loadable URL, or null when the caller is
   * not allowed to see it.
   *
   * Anything already absolute is returned untouched — Cloudinary uploads are
   * not ours to sign, and blob: previews of a photo not yet filed must not be
   * sent to the server at all.
   */
  async resolve(reference: string | null | undefined): Promise<string | null> {
    if (!reference) return null;
    if (/^(https?:|blob:|data:)/.test(reference)) return reference;

    const hit = this.cache.get(reference);
    if (hit && hit.expires > Date.now()) return hit.url;

    // Two cards showing the same photo should cost one request, not two.
    const pending = this.inflight.get(reference);
    if (pending) return pending;

    const request = this.sign(reference).finally(() => this.inflight.delete(reference));
    this.inflight.set(reference, request);
    return request;
  }

  private async sign(path: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, TTL_SECONDS);

    // A refusal is the expected answer for a photo this person may not see, so
    // it is not an error condition — the caller shows a placeholder instead.
    if (error || !data?.signedUrl) return null;

    this.cache.set(path, {
      url: data.signedUrl,
      expires: Date.now() + TTL_SECONDS * 1000 - REFRESH_MARGIN_MS,
    });

    return data.signedUrl;
  }

  /** Drops a cached URL, so the next render re-signs it. Used after deletion. */
  forget(reference: string): void {
    this.cache.delete(reference);
  }
}
