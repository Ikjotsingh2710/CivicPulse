import { Component, ElementRef, HostListener, effect, inject, viewChild } from '@angular/core';

import { LightboxService } from '../core/lightbox.service';

/**
 * Full-screen photo viewer, mounted once at the app root.
 *
 * Report photos are the evidence in this system — a pothole's depth or a
 * streetlight's damage is often unreadable in a 130px thumbnail — so every
 * stored photo can be opened at full size.
 *
 * Dismissal is deliberately over-provided: the ✕ button, the backdrop, and
 * Escape all close it. On a phone the backdrop is most of the screen and is
 * what people reach for first; on a desktop it is Escape.
 */
@Component({
  selector: 'cp-photo-lightbox',
  standalone: true,
  template: `
    @if (lightbox.photo(); as photo) {
      <div
        class="backdrop"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="photo.alt"
        (click)="onBackdrop($event)"
      >
        <button #closeButton type="button" class="close" aria-label="Close full screen" (click)="lightbox.close()">
          <span aria-hidden="true">✕</span>
        </button>

        <img [src]="photo.src" [alt]="photo.alt" />

        <p class="caption">{{ photo.alt }}</p>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 200;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      padding: 24px;
      background: rgba(2, 24, 15, 0.92);
      backdrop-filter: blur(4px);
      animation: fade 0.14s ease-out;
    }

    @keyframes fade {
      from {
        opacity: 0;
      }
    }

    img {
      max-width: 100%;
      /* Leaves room for the caption and the close button on short screens. */
      max-height: calc(100vh - 128px);
      object-fit: contain;
      border-radius: var(--radius);
      box-shadow: var(--shadow-floating);
      /* The backdrop closes on click; the photo itself must not. */
      cursor: default;
    }

    .caption {
      margin: 0;
      max-width: 60ch;
      text-align: center;
      font-size: 0.86rem;
      color: var(--cream-dim);
    }

    .close {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      border: 1px solid var(--green-line);
      background: rgba(2, 24, 15, 0.75);
      color: var(--cream);
      font-size: 1.15rem;
      line-height: 1;
      cursor: pointer;
    }

    .close:hover {
      background: var(--green-800);
      border-color: var(--gold-soft);
    }

    .close:focus-visible {
      outline: 2px solid var(--gold);
      outline-offset: 2px;
    }

    @media (max-width: 560px) {
      .backdrop {
        padding: 16px;
      }

      .close {
        top: 10px;
        right: 10px;
      }
    }

    /* Honour a reduced-motion preference: the fade is decoration, not feedback. */
    @media (prefers-reduced-motion: reduce) {
      .backdrop {
        animation: none;
      }
    }
  `,
})
export class PhotoLightbox {
  protected readonly lightbox = inject(LightboxService);

  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');

  constructor() {
    effect(() => {
      const open = this.lightbox.photo() !== null;

      // Stops the page behind from scrolling under the overlay, which on touch
      // devices otherwise moves the moment a drag starts on the backdrop.
      document.body.style.overflow = open ? 'hidden' : '';

      // Move focus in so Escape and Tab act on the dialog rather than on
      // whatever thumbnail was clicked behind it.
      if (open) this.closeButton()?.nativeElement.focus();
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.lightbox.close();
  }

  /** Clicks on the photo bubble to here; only a hit on the backdrop closes. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.lightbox.close();
  }
}
