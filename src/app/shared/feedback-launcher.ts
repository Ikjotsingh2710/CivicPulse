import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  FEEDBACK_LIMIT,
  FeedbackService,
  type Sentiment,
} from '../core/feedback.service';

const SENTIMENTS: readonly { value: Sentiment; label: string; icon: string }[] = [
  { value: 'Good', label: 'Working well', icon: '☺' },
  { value: 'Okay', label: 'Mixed', icon: '◔' },
  { value: 'Bad', label: 'Frustrating', icon: '☹' },
];

/**
 * The embossed Feedback pill and the dialog it opens.
 *
 * Kept open to signed-out visitors on purpose: someone who could not get
 * through registration is exactly the person whose feedback is worth having,
 * and asking them to sign in first would lose it.
 */
@Component({
  selector: 'cp-feedback-launcher',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="launcher">
      <button
        type="button"
        class="pill"
        aria-haspopup="dialog"
        [attr.aria-expanded]="open()"
        (click)="openDialog()"
      >
        Feedback
      </button>
      <p class="tagline">Tell us what would make this better.</p>
    </div>

    @if (open()) {
      <div class="scrim" (click)="onScrimClick($event)">
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="fb-title">
          @if (sent()) {
            <h2 id="fb-title">Thank you</h2>
            <p class="muted">
              That goes straight to the people building CivicPulse. If you left your number with
              us, we may follow up.
            </p>
            <div class="actions">
              <button class="btn-slate" type="button" (click)="close()">Close</button>
            </div>
          } @else {
            <h2 id="fb-title">How is CivicPulse working for you?</h2>
            <p class="muted lead">
              Tell us what felt slow, confusing or broken — or what you'd want next.
            </p>

            @if (error(); as message) {
              <p class="alert alert-error" role="alert">{{ message }}</p>
            }

            <div class="moods" role="radiogroup" aria-label="Overall experience">
              @for (mood of sentiments; track mood.value) {
                <button
                  type="button"
                  role="radio"
                  class="mood"
                  [class.active]="sentiment() === mood.value"
                  [attr.aria-checked]="sentiment() === mood.value"
                  (click)="pick(mood.value)"
                >
                  <span class="mood-icon" aria-hidden="true">{{ mood.icon }}</span>
                  {{ mood.label }}
                </button>
              }
            </div>

            <div class="field">
              <label for="fb-message">Your thoughts</label>
              <textarea
                id="fb-message"
                name="message"
                rows="5"
                [maxlength]="limit"
                placeholder="What would you change first?"
                [ngModel]="message()"
                (ngModelChange)="message.set($event)"
              ></textarea>
              <p class="count" [class.warn]="remaining() <= 40">
                {{ message().length }}/{{ limit }}
              </p>
            </div>

            <div class="actions">
              <button class="btn-ghost" type="button" (click)="close()">Cancel</button>
              <button
                class="btn-slate"
                type="button"
                (click)="send()"
                [disabled]="busy() || message().trim().length === 0"
              >
                {{ busy() ? 'Sending…' : 'Send feedback' }}
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .launcher {
      text-align: center;
      padding: 8px 20px clamp(40px, 7vh, 76px);
    }

    /* Embossed: the label is cut into the surface by a dark top shadow and a
       light bottom highlight, with the pill itself lifted by the inverse. */
    .pill {
      border-radius: 999px;
      padding: 15px 46px;
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.06rem;
      letter-spacing: 0.02em;
      color: #6d675a;
      background: linear-gradient(180deg, #f7f4ec 0%, #e6e1d4 100%);
      border: 1px solid rgba(109, 103, 90, 0.22);
      text-shadow:
        0 -1px 0 rgba(84, 78, 66, 0.34),
        0 1px 0 rgba(255, 255, 255, 0.95);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.95),
        inset 0 -2px 3px rgba(109, 103, 90, 0.18),
        0 2px 3px rgba(30, 39, 43, 0.1),
        0 10px 22px -10px rgba(30, 39, 43, 0.35);
      transition:
        transform 110ms ease,
        box-shadow 160ms ease,
        color 160ms ease;
    }

    .pill:hover {
      color: var(--green-700);
    }

    /* Pressing genuinely inverts the lighting, so it reads as pushed in. */
    .pill:active {
      transform: translateY(2px);
      color: #5d5749;
      text-shadow:
        0 1px 0 rgba(255, 255, 255, 0.8),
        0 -1px 0 rgba(84, 78, 66, 0.3);
      box-shadow:
        inset 0 2px 4px rgba(109, 103, 90, 0.3),
        inset 0 -1px 0 rgba(255, 255, 255, 0.6);
    }

    .pill:focus-visible {
      outline: none;
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.95),
        0 0 0 4px rgba(5, 96, 57, 0.25);
    }

    .tagline {
      margin: 12px 0 0;
      font-size: 0.86rem;
      color: var(--ink-muted);
    }

    /* ------------------------------------------------------------- dialog */

    .scrim {
      position: fixed;
      inset: 0;
      z-index: 120;
      background: rgba(9, 17, 22, 0.58);
      backdrop-filter: blur(3px);
      display: grid;
      place-items: center;
      padding: 18px;
      animation: fb-fade 150ms ease;
    }

    @keyframes fb-fade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .sheet {
      width: min(520px, 100%);
      background: var(--surface-elevated);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-floating);
      padding: 24px;
      animation: dropdown-in 150ms ease forwards;
    }

    h2 {
      font-size: 1.18rem;
      margin-bottom: 6px;
    }

    .lead {
      margin: 0 0 18px;
      font-size: 0.92rem;
    }

    .moods {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 18px;
    }

    .mood {
      background: var(--surface-sunken);
      border: 1px solid var(--line);
      color: var(--ink-muted);
      border-radius: 10px;
      padding: 11px 8px;
      font-size: 0.84rem;
      font-weight: 500;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .mood-icon {
      font-size: 1.15rem;
      line-height: 1;
    }

    .mood:hover {
      border-color: var(--ink-muted);
      color: var(--ink-strong);
    }

    .mood:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--accent-soft);
    }

    .mood.active {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: var(--accent-strong);
      font-weight: 600;
    }

    .count {
      margin: 5px 0 0;
      text-align: right;
      font-size: 0.77rem;
      color: var(--ink-muted);
      font-variant-numeric: tabular-nums;
    }

    .count.warn {
      color: var(--warn);
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 8px;
    }
  `,
})
export class FeedbackLauncher {
  private readonly service = inject(FeedbackService);

  protected readonly sentiments = SENTIMENTS;
  protected readonly limit = FEEDBACK_LIMIT;

  protected readonly open = signal(false);
  protected readonly sent = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly sentiment = signal<Sentiment | null>(null);
  protected readonly message = signal('');

  protected readonly remaining = computed(() => FEEDBACK_LIMIT - this.message().length);

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.close();
  }

  protected openDialog(): void {
    this.sent.set(false);
    this.error.set(null);
    this.open.set(true);
  }

  /** Only a click on the backdrop itself closes; clicks inside must not. */
  protected onScrimClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('scrim')) this.close();
  }

  protected close(): void {
    this.open.set(false);
  }

  protected pick(value: Sentiment): void {
    this.sentiment.set(this.sentiment() === value ? null : value);
  }

  protected async send(): Promise<void> {
    if (this.busy()) return;

    this.busy.set(true);
    this.error.set(null);

    try {
      await this.service.submit({ sentiment: this.sentiment(), message: this.message() });
      this.sent.set(true);
      this.message.set('');
      this.sentiment.set(null);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not send your feedback.');
    } finally {
      this.busy.set(false);
    }
  }
}
