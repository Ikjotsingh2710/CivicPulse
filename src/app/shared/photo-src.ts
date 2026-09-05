import { Directive, ElementRef, effect, inject, input, signal } from '@angular/core';

import { PhotoService } from '../core/photo.service';

/**
 * Loads a stored report photo into an `<img>`: `<img [cpPhoto]="ticket.image_url">`.
 *
 * Replaces a plain `[src]` binding because the value in the database is now an
 * object path, not an address — the bucket is private, and a signed URL has to
 * be minted for each one. Doing that in a directive keeps the asynchrony out of
 * six page templates that only want to show a photo.
 *
 * An image the caller is not allowed to see resolves to nothing. Rather than
 * leave a broken-image glyph, the element is hidden and a `data-denied`
 * attribute is set, so a page can style the gap if it wants to.
 */
@Directive({
  selector: 'img[cpPhoto]',
  standalone: true,
  host: {
    '[attr.data-denied]': 'denied() ? "" : null',
    '[style.visibility]': 'denied() ? "hidden" : null',
  },
})
export class PhotoSrc {
  /** The stored reference: an object path, or an absolute URL to pass through. */
  readonly cpPhoto = input<string | null | undefined>();

  protected readonly denied = signal(false);

  private readonly host = inject(ElementRef<HTMLImageElement>);
  private readonly photos = inject(PhotoService);

  constructor() {
    effect(() => {
      const reference = this.cpPhoto();
      const img = this.host.nativeElement as HTMLImageElement;

      if (!reference) {
        img.removeAttribute('src');
        this.denied.set(true);
        return;
      }

      void this.photos.resolve(reference).then((url) => {
        // The row may have been replaced while this was in flight; only apply
        // the result if it still belongs to the reference now bound.
        if (this.cpPhoto() !== reference) return;

        if (url) {
          img.src = url;
          this.denied.set(false);
        } else {
          img.removeAttribute('src');
          this.denied.set(true);
        }
      });
    });
  }
}
