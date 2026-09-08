import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { I18nService } from '../core/i18n.service';
import { PortalService } from '../core/portal.service';
import type { GrievanceTicket } from '../core/models';
import type { HandoffResult, Jurisdiction, Portal, PreparedComplaint } from '../core/portal/connector';


/**
 * "Ready to send to X" — one button that carries a complaint to a government
 * portal with nothing left to retype.
 *
 * The citizen never picks a department. CivicPulse works it out, says which
 * one and why, and offers a change if the guess is wrong. That sentence is the
 * feature: a person who photographs a broken streetlight should not have to
 * research whether their street belongs to MCD or NDMC before they can report
 * it to anybody.
 *
 * What the button does is deliberately modest — copy, download, open. The
 * citizen submits their own complaint on the government's own site, with their
 * own OTP. CivicPulse removes the typing, not the person.
 */
@Component({
  selector: 'cp-portal-handoff',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (portal(); as body) {
      <div class="handoff card" [class.done]="sent()">
        @switch (stage()) {
          @case ('ready') {
            <p class="eyebrow">{{ t('portal.eyebrow') }}</p>
            <h3>{{ t('portal.readyTo', { name: body.name }) }}</h3>
            <p class="muted why">{{ reason() }}</p>

            @if (result()?.status === 'failed') {
              <p class="alert alert-error" role="alert">{{ result()?.message }}</p>
            }

            <div class="actions">
              <button
                class="btn-primary send"
                type="button"
                [disabled]="preparing() || busy()"
                (click)="send()"
              >
                {{
                  preparing()
                    ? t('portal.gettingReady')
                    : busy()
                      ? t('portal.opening')
                      : t('portal.sendIt')
                }}
              </button>
              <button class="btn-ghost" type="button" (click)="picking.set(!picking())">
                {{
                  picking()
                    ? t('portal.keep', { jurisdiction: body.jurisdiction })
                    : t('portal.wrongDept')
                }}
              </button>
            </div>

            @if (picking()) {
              <!-- Described choices, not a list of acronyms. Someone overruling
                   our guess is doing it because they know their own street —
                   they should be picking between what these bodies do. -->
              <div class="switcher" role="listbox" [attr.aria-label]="t('portal.sendTo')">
                @for (option of options(); track option.jurisdiction) {
                  <button
                    type="button"
                    class="option"
                    role="option"
                    [class.on]="option.jurisdiction === body.jurisdiction"
                    [attr.aria-selected]="option.jurisdiction === body.jurisdiction"
                    (click)="choose(option.jurisdiction)"
                  >
                    <span class="option-name">{{ option.name }}</span>
                    <span class="option-covers">{{ covers(option.jurisdiction) }}</span>
                  </button>
                }
              </div>
            }

            <p class="muted fineprint">
              {{ t('portal.fineprint', { name: body.name }) }}
            </p>

            <!-- Shown before the handoff, not only after it. A portal is the
                 wrong channel for a burst main at midnight, and someone on a
                 weak connection may not get one to load at all. -->
            @if (body.helpline || body.whatsapp) {
              <div class="contacts">
                <span class="muted label">{{ t('portal.reachDirectly') }}</span>
                @if (body.helpline) {
                  <a class="contact" [href]="'tel:' + dial(body.helpline)">
                    <span aria-hidden="true">📞</span> {{ body.helpline }}
                  </a>
                }
                @if (body.whatsapp) {
                  <a
                    class="contact"
                    [href]="'https://wa.me/91' + body.whatsapp"
                    target="_blank"
                    rel="noopener"
                  >
                    <span aria-hidden="true">💬</span> WhatsApp
                  </a>
                }
              </div>
            }
          }

          @case ('handed-off') {
            <p class="eyebrow">{{ t('portal.waitingOnYou') }}</p>
            <h3>{{ t('portal.openInTab', { name: body.name }) }}</h3>

            <ol class="steps">
              <li [class.missed]="!result()?.copied">
                {{ result()?.copied ? t('portal.stepCopied') : t('portal.stepCopyManual') }}
              </li>
              <li [class.missed]="!result()?.photoSaved">
                {{
                  result()?.photoSaved ? t('portal.stepPhotoSaved') : t('portal.stepPhotoManual')
                }}
              </li>
              <li>{{ t('portal.stepSubmit') }}</li>
            </ol>

            @if (!result()?.copied && prepared(); as ready) {
              <!-- Clipboard permission can be refused, and on an insecure
                   origin the API does not exist at all. The text itself is the
                   fallback: selectable, and never lost behind a failed API. -->
              <textarea class="fallback" readonly rows="8">{{ ready.body }}</textarea>
              <button class="btn-ghost" type="button" (click)="copyAgain()">
                {{ copiedNow() ? t('portal.copied') : t('portal.copyComplaint') }}
              </button>
            }

            <div class="field reference">
              <label for="reference">{{ t('portal.theirNumber') }}</label>
              <input
                id="reference"
                name="reference"
                placeholder="e.g. 2026-823TUU"
                [(ngModel)]="reference"
                [disabled]="busy()"
              />
              <span class="muted fineprint">{{ t('portal.referenceHint') }}</span>
            </div>

            @if (error(); as message) {
              <p class="alert alert-error" role="alert">{{ message }}</p>
            }

            <div class="actions">
              <button
                class="btn-primary"
                type="button"
                [disabled]="busy() || !reference.trim()"
                (click)="saveReference()"
              >
                {{ busy() ? t('portal.saving') : t('portal.saveNumber') }}
              </button>
              <a class="btn-ghost link-btn" [href]="body.web_url" target="_blank" rel="noopener">
                {{ t('portal.reopen', { jurisdiction: body.jurisdiction }) }}
              </a>
            </div>

            @if (body.helpline || body.whatsapp) {
              <div class="contacts">
                <span class="muted label">{{ t('portal.stuck') }}</span>
                @if (body.helpline) {
                  <a class="contact" [href]="'tel:' + dial(body.helpline)">
                    <span aria-hidden="true">📞</span> {{ body.helpline }}
                  </a>
                }
                @if (body.whatsapp) {
                  <a
                    class="contact"
                    [href]="'https://wa.me/91' + body.whatsapp"
                    target="_blank"
                    rel="noopener"
                  >
                    <span aria-hidden="true">💬</span> WhatsApp
                  </a>
                }
              </div>
            }
          }

          @case ('tracked') {
            <p class="eyebrow">{{ t('portal.filedWithAuthority') }}</p>
            <h3>{{ body.name }} · {{ ticket().portal_reference_id }}</h3>
            <p class="muted why">{{ t('portal.trackedTogether') }}</p>
            <div class="actions">
              <a class="btn-ghost link-btn" [href]="body.web_url" target="_blank" rel="noopener">
                {{ t('portal.checkStatus', { jurisdiction: body.jurisdiction }) }}
              </a>
            </div>

            @if (body.helpline || body.whatsapp) {
              <div class="contacts">
                <span class="muted label">{{ t('portal.chase') }}</span>
                @if (body.helpline) {
                  <a class="contact" [href]="'tel:' + dial(body.helpline)">
                    <span aria-hidden="true">📞</span> {{ body.helpline }}
                  </a>
                }
                @if (body.whatsapp) {
                  <a
                    class="contact"
                    [href]="'https://wa.me/91' + body.whatsapp"
                    target="_blank"
                    rel="noopener"
                  >
                    <span aria-hidden="true">💬</span> WhatsApp
                  </a>
                }
              </div>
            }
          }
        }

        @if (overdue()) {
          <!-- 24 hours on, still unconfirmed. It links back to the same portal
               and asks for the number; it never resubmits anything, because
               the citizen may well have filed it and simply not told us. -->
          <p class="alert nudge" role="status">
            {{ t('portal.nudge', { jurisdiction: body.jurisdiction }) }}
          </p>
        }
      </div>
    }
  `,
  styles: `
    .handoff {
      margin-top: 18px;
      border-left: 3px solid var(--accent);
    }

    .handoff.done {
      border-left-color: var(--green-600);
    }

    .eyebrow {
      margin: 0;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }

    h3 {
      margin: 6px 0 8px;
      font-family: var(--font-display);
      font-size: 1.15rem;
      letter-spacing: -0.02em;
    }

    .why {
      margin: 0 0 14px;
      max-width: 58ch;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-top: 14px;
    }

    .send {
      min-width: 140px;
    }

    .link-btn {
      display: inline-block;
      text-decoration: none;
      padding: 11px 18px;
      border-radius: var(--radius);
    }

    .switcher {
      display: grid;
      gap: 8px;
      margin-top: 14px;
    }

    .option {
      display: grid;
      gap: 3px;
      text-align: left;
      padding: 10px 13px;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius);
      background: var(--surface-elevated);
      color: var(--ink);
      font: inherit;
      cursor: pointer;
    }

    .option:hover,
    .option:focus-visible {
      border-color: var(--accent);
    }

    .option.on {
      border-color: var(--accent);
      background: var(--accent-soft);
    }

    .option-name {
      font-weight: 700;
      font-size: 0.92rem;
    }

    .option-covers {
      font-size: 0.82rem;
      color: var(--ink-muted);
    }

    .steps {
      margin: 0 0 4px;
      padding-left: 20px;
      line-height: 1.7;
    }

    /* A step that did not happen is not a failure — it is one the citizen has
       to do by hand, so it reads as an instruction rather than an error. */
    .steps .missed {
      color: var(--ink-muted);
    }

    .fallback {
      width: 100%;
      margin: 10px 0;
      font-family: ui-monospace, monospace;
      font-size: 0.8rem;
      resize: vertical;
    }

    .reference {
      margin-top: 16px;
    }

    .fineprint {
      display: block;
      margin-top: 10px;
      font-size: 0.8rem;
      max-width: 58ch;
    }

    .contacts {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 14px;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid var(--line);
    }

    .contacts .label {
      font-size: 0.8rem;
    }

    /* Sized as a tap target, not a text link: on a phone this is someone
       reaching for a call while standing over the problem. */
    .contact {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius);
      font-size: 0.86rem;
      font-weight: 600;
      text-decoration: none;
      color: var(--ink-strong);
      font-variant-numeric: tabular-nums;
    }

    .contact:hover,
    .contact:focus-visible {
      border-color: var(--accent);
      color: var(--accent-strong);
    }

    .nudge {
      margin-top: 16px;
      background: var(--warn-soft);
      color: var(--warn);
    }
  `,
})
export class PortalHandoff implements OnInit {
  protected readonly i18n = inject(I18nService);
  /** Bound so templates read `t('key')`; repaints when the language changes. */
  protected readonly t = this.i18n.t.bind(this.i18n);

  private readonly portals = inject(PortalService);

  readonly ticket = input.required<GrievanceTicket>();
  /** Fires once the citizen records a reference, so the page can refresh. */
  readonly tracked = output<string>();

  protected readonly portal = signal<Portal | null>(null);
  protected readonly reason = signal('');
  protected readonly prepared = signal<PreparedComplaint | null>(null);
  protected readonly result = signal<HandoffResult | null>(null);

  protected readonly preparing = signal(false);
  protected readonly busy = signal(false);
  protected readonly picking = signal(false);
  protected readonly copiedNow = signal(false);
  protected readonly error = signal<string | null>(null);

  protected reference = '';

  /**
   * Which of the three faces to show.
   *
   * Driven off the stored ticket rather than local state, so a citizen who
   * closes the tab and comes back to /profile tomorrow sees where they left
   * off instead of a fresh "Send it".
   */
  protected readonly stage = computed<'ready' | 'handed-off' | 'tracked'>(() => {
    const status = this.ticket().portal_status;
    if (status === 'submitted') return 'tracked';
    if (status === 'awaiting_user_submission') return 'handed-off';
    return 'ready';
  });

  protected readonly sent = computed(() => this.stage() === 'tracked');
  protected readonly overdue = computed(() => this.portals.needsReminder(this.ticket()));

  /** Bodies that could plausibly act on this problem, best guess first. */
  protected readonly options = signal<readonly Portal[]>([]);

  ngOnInit(): void {
    // Not the constructor: a required input has no value until after
    // construction, so reading `ticket()` there throws — and because load() is
    // async that throw became a silently rejected promise and the card simply
    // never appeared.
    void this.load();
  }

  private async load(override?: Jurisdiction): Promise<void> {
    // A campus report belongs to the campus. Nothing is shown at all rather
    // than offering to send a university's pothole to the corporation.
    if (!this.portals.offersHandoff(this.ticket())) return;

    try {
      const [routed, alternatives] = await Promise.all([
        this.portals.route(this.ticket(), override),
        this.portals.alternatives(this.ticket()),
      ]);

      this.options.set(alternatives);
      if (!routed) return;

      this.portal.set(routed.portal);
      this.reason.set(routed.decision.reason);

      // Formatting runs now, not on the click. `window.open` only works while
      // the browser still considers itself inside the gesture that caused it,
      // and awaiting a geocode first is enough to lose that.
      if (this.stage() === 'ready') await this.prime(routed.portal);
    } catch {
      // A directory that will not load means no handoff is offered. The report
      // itself is already filed with CivicPulse, so nothing is lost.
      this.portal.set(null);
    }
  }

  private async prime(portal: Portal): Promise<void> {
    this.preparing.set(true);
    try {
      this.prepared.set(await this.portals.prepare(portal, this.ticket()));
    } catch {
      this.prepared.set(null);
    } finally {
      this.preparing.set(false);
    }
  }

  protected async choose(jurisdiction: Jurisdiction): Promise<void> {
    this.picking.set(false);
    this.prepared.set(null);
    await this.load(jurisdiction);
  }

  protected async send(): Promise<void> {
    const portal = this.portal();
    const ready = this.prepared();
    if (!portal || !ready || this.busy()) return;

    this.busy.set(true);
    this.error.set(null);

    try {
      this.result.set(await this.portals.handoff(portal, ready));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not open the portal.');
    } finally {
      this.busy.set(false);
    }
  }

  /** One line on what a body covers, for the override list. */
  protected covers(jurisdiction: Jurisdiction): string {
    return this.i18n.covers(jurisdiction);
  }

  /**
   * Strips a published number down to something `tel:` will dial.
   *
   * Helplines are published in whatever shape reads well — `1800-103-0222`,
   * `011-25693837`, the short code `1916`. A phone dialer wants the digits.
   */
  protected dial(helpline: string): string {
    return helpline.replace(/[^0-9+]/g, '');
  }

  /** Manual retry for when the clipboard API was refused the first time. */
  protected async copyAgain(): Promise<void> {
    const ready = this.prepared();
    if (!ready) return;

    try {
      await navigator.clipboard.writeText(ready.body);
      this.copiedNow.set(true);
    } catch {
      // Nothing more to offer: the text is on screen and selectable.
      this.copiedNow.set(false);
    }
  }

  protected async saveReference(): Promise<void> {
    if (this.busy() || !this.reference.trim()) return;

    this.busy.set(true);
    this.error.set(null);

    try {
      await this.portals.recordReference(this.ticket().id, this.reference);
      this.tracked.emit(this.reference.trim());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not save that number.');
    } finally {
      this.busy.set(false);
    }
  }
}
