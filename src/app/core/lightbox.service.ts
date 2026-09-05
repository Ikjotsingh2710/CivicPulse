import { Injectable, signal } from '@angular/core';

export interface LightboxPhoto {
  src: string;
  /** Reused as the dialog's accessible name, so it should describe the photo. */
  alt: string;
}

/**
 * Holds whichever photo is currently open full screen.
 *
 * A single shared signal rather than one overlay per page: the viewer is
 * mounted once at the app root, so a photo opened from the admin feed, the
 * profile timeline or the resolved gallery all reuse the same element, and
 * there is never more than one overlay in the DOM to stack or dismiss.
 */
@Injectable({ providedIn: 'root' })
export class LightboxService {
  private readonly current = signal<LightboxPhoto | null>(null);

  readonly photo = this.current.asReadonly();

  open(src: string, alt: string): void {
    if (!src) return;
    this.current.set({ src, alt });
  }

  close(): void {
    this.current.set(null);
  }
}
