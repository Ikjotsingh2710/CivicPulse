import { Directive, ElementRef, HostListener, inject } from '@angular/core';

import { LightboxService } from '../core/lightbox.service';

/**
 * Marks an `<img>` as openable full screen: `<img cpZoom [src]="..." alt="..." />`.
 *
 * A directive rather than a wrapper component so it can be added to the photos
 * already on these pages without touching their markup or the CSS that sizes
 * them — every existing rule still targets the same `<img>` element.
 *
 * The image becomes a real button as far as assistive tech and the keyboard are
 * concerned, because a click-only zoom is unreachable without a mouse.
 */
@Directive({
  selector: 'img[cpZoom]',
  standalone: true,
  host: {
    role: 'button',
    tabindex: '0',
    '[attr.aria-label]': '"View photo full screen: " + (alt || "photo")',
    '[style.cursor]': '"zoom-in"',
  },
})
export class PhotoZoom {
  private readonly host = inject(ElementRef<HTMLImageElement>);
  private readonly lightbox = inject(LightboxService);

  protected get alt(): string {
    return this.host.nativeElement.alt ?? '';
  }

  @HostListener('click')
  protected onClick(): void {
    this.open();
  }

  @HostListener('keydown.enter', ['$event'])
  @HostListener('keydown.space', ['$event'])
  protected onKey(event: Event): void {
    // Space would otherwise scroll the page out from under the photo.
    event.preventDefault();
    this.open();
  }

  private open(): void {
    const img = this.host.nativeElement as HTMLImageElement;
    // `currentSrc` is what the browser actually loaded; it falls back to `src`
    // when the image has not finished loading yet.
    this.lightbox.open(img.currentSrc || img.src, img.alt || 'Report photo');
  }
}
