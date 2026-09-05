import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';

import type { DuplicateMatch } from '../core/models';

/**
 * Asks whether the report being filed is the same problem as one already open
 * nearby.
 *
 * Deliberately a question rather than a refusal. Proximity is a guess — two
 * genuinely different potholes can sit forty metres apart — so the citizen is
 * shown the existing photo and makes the call. Answering "same problem" adds
 * their weight to the existing report instead of creating a second one; the
 * escape hatch is always one tap away.
 */
@Component({
  selector: 'cp-duplicate-prompt',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="scrim" role="dialog" aria-modal="true" aria-labelledby="dup-title">
      <div class="sheet card">
        <h2 id="dup-title">Already reported?</h2>
        <p class="muted lead">
          Someone reported this {{ match().distance_m }}m from here. If it is the same problem,
          adding your voice pushes it up the ward desk's list.
        </p>

        <article class="match">
          <img [src]="match().image_url" [alt]="'Reported ' + match().category" />
          <div>
            <p class="number">{{ match().ticket_number }}</p>
            <h3>{{ match().category }}</h3>
            <p class="muted meta">
              {{ match().ward_location }} · reported
              {{ match().created_at | date: 'd MMM y' }}
              @if (match().user_name) {
                by {{ match().user_name }}
              }
            </p>
            @if (match().description) {
              <p class="body">{{ match().description }}</p>
            }
            <p class="weight">
              {{ match().upvote_count }}
              {{ match().upvote_count === 1 ? 'person has' : 'people have' }} backed this
            </p>
          </div>
        </article>

        <div class="actions">
          <button type="button" class="btn-primary" [disabled]="busy()" (click)="same.emit()">
            {{ busy() ? 'Adding…' : 'Yes — this is the same problem' }}
          </button>
          <button type="button" class="btn-ghost" [disabled]="busy()" (click)="different.emit()">
            No, mine is different
          </button>
        </div>

        <p class="muted foot">
          Pulse Points go to whoever reported the problem first, so backing an existing report does
          not earn points — but it does get the problem fixed sooner.
        </p>
      </div>
    </div>
  `,
  styles: `
    .scrim {
      position: fixed;
      inset: 0;
      z-index: 180;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(2, 24, 15, 0.72);
      backdrop-filter: blur(3px);
      overflow-y: auto;
    }

    .sheet {
      width: 100%;
      max-width: 470px;
      box-shadow: var(--shadow-floating);
    }

    h2 {
      margin: 0 0 4px;
    }

    .lead {
      margin: 0 0 16px;
      font-size: 0.9rem;
    }

    .match {
      display: grid;
      grid-template-columns: 96px 1fr;
      gap: 14px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface-sunken);
    }

    .match img {
      width: 96px;
      height: 96px;
      object-fit: cover;
      border-radius: 9px;
      border: 1px solid var(--line);
    }

    .number {
      font-family: var(--font-display);
      font-size: 0.72rem;
      letter-spacing: 0.1em;
      color: var(--accent-strong);
      margin: 0 0 2px;
    }

    .match h3 {
      margin: 0 0 3px;
      font-size: 1.02rem;
    }

    .meta {
      margin: 0;
      font-size: 0.8rem;
    }

    .body {
      margin: 7px 0 0;
      font-size: 0.86rem;
    }

    .weight {
      margin: 7px 0 0;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--accent-strong);
    }

    .actions {
      display: grid;
      gap: 8px;
      margin-top: 16px;
    }

    .foot {
      margin: 14px 0 0;
      font-size: 0.78rem;
    }

    @media (max-width: 480px) {
      .match {
        grid-template-columns: 1fr;
      }

      .match img {
        width: 100%;
        height: 140px;
      }
    }
  `,
})
export class DuplicatePrompt {
  readonly match = input.required<DuplicateMatch>();
  readonly busy = input(false);

  /** "Yes, same problem" — the host should upvote and drop the draft. */
  readonly same = output<void>();
  /** "Mine is different" — the host should file the report as normal. */
  readonly different = output<void>();
}
