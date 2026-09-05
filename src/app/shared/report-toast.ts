import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { NotificationsService } from '../core/notifications.service';

/**
 * The "new report just came in" toast for the ward desk.
 *
 * Deliberately not a browser push notification: those need permission prompts
 * and a service worker, and a desk that has the app open does not need the
 * operating system to interrupt it. This appears in the corner, says which
 * ticket arrived, and takes one tap to open the queue.
 *
 * It does not auto-dismiss. A notification that vanishes while you are looking
 * at something else is the same as no notification at all — the badge on the
 * Control Desk link is the persistent count; this is the interruption.
 */
@Component({
  selector: 'cp-report-toast',
  standalone: true,
  template: `
    @if (notifications.alert(); as alert) {
      <div class="toast" role="status" aria-live="polite">
        <span class="dot" aria-hidden="true"></span>

        <div class="body">
          <p class="lead">New report</p>
          @if (alert.id === 'poll') {
            <p class="detail">{{ alert.ticket_number }} {{ alert.category }} waiting</p>
          } @else {
            <p class="detail">
              {{ alert.ticket_number }} · {{ alert.category }}
              @if (alert.ward_location) {
                · {{ alert.ward_location }}
              }
            </p>
            @if (alert.user_name) {
              <p class="who">from {{ alert.user_name }}</p>
            }
          }
        </div>

        <div class="actions">
          <button type="button" class="open" (click)="open()">Open desk</button>
          <button type="button" class="close" aria-label="Dismiss" (click)="notifications.dismiss()">
            ✕
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .toast {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 210;
      display: flex;
      align-items: flex-start;
      gap: 11px;
      max-width: 340px;
      padding: 13px 15px;
      border-radius: var(--radius);
      border: 1px solid var(--green-line);
      background: var(--green-900);
      color: var(--cream);
      box-shadow: var(--shadow-floating);
      animation: rise 0.2s ease-out;
    }

    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .toast {
        animation: none;
      }
    }

    .dot {
      width: 9px;
      height: 9px;
      margin-top: 5px;
      border-radius: 50%;
      background: var(--map-route);
      box-shadow: 0 0 0 4px rgba(61, 220, 132, 0.18);
      flex-shrink: 0;
    }

    .body {
      flex: 1;
      min-width: 0;
    }

    .lead {
      margin: 0;
      font-family: var(--font-display);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--map-route);
    }

    .detail {
      margin: 2px 0 0;
      font-size: 0.88rem;
      font-weight: 600;
      line-height: 1.35;
    }

    .who {
      margin: 1px 0 0;
      font-size: 0.78rem;
      color: var(--cream-dim);
    }

    .actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 7px;
      flex-shrink: 0;
    }

    .open {
      border: 1px solid var(--green-line);
      background: var(--green-700);
      color: var(--cream);
      font-family: var(--font-body);
      font-size: 0.76rem;
      font-weight: 700;
      padding: 5px 10px;
      border-radius: 7px;
      cursor: pointer;
      white-space: nowrap;
    }

    .open:hover {
      background: var(--green-600);
    }

    .close {
      border: none;
      background: none;
      color: var(--cream-dim);
      font-size: 0.85rem;
      line-height: 1;
      padding: 2px 4px;
      cursor: pointer;
    }

    .close:hover {
      color: var(--cream);
    }

    .open:focus-visible,
    .close:focus-visible {
      outline: 2px solid var(--gold);
      outline-offset: 2px;
    }

    @media (max-width: 560px) {
      .toast {
        right: 12px;
        left: 12px;
        bottom: 12px;
        max-width: none;
      }
    }
  `,
})
export class ReportToast {
  protected readonly notifications = inject(NotificationsService);
  private readonly router = inject(Router);

  protected open(): void {
    this.notifications.dismiss();
    void this.router.navigate(['/admin']);
  }
}
