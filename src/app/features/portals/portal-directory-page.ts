import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../core/i18n.service';
import { PortalService } from '../../core/portal.service';
import { TICKET_CATEGORIES } from '../../core/models';
import type { Jurisdiction, Portal } from '../../core/portal/connector';
import { handlesCategory } from '../../core/portal/jurisdiction';

/**
 * Every body a complaint can reach, and how to reach it.
 *
 * The handoff card only appears once a report exists, which leaves a real gap:
 * a burst main at midnight, a billing dispute, a water tanker request — none of
 * those start with photographing a pothole, and until now none of them had
 * anywhere to go in this app. This page is that.
 *
 * It deliberately does not try to be the reporting flow. Filing through
 * CivicPulse is still better — you get a tracked ticket, a ward desk chasing
 * it, and the complaint pre-formatted — and the page says so rather than
 * quietly competing with itself.
 */
@Component({
  selector: 'cp-portal-directory-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page">
      <h1>{{ t('portals.title') }}</h1>
      <p class="muted lead">{{ t('portals.lead') }}</p>
      <p class="muted lead coverage">{{ t('portals.coverageNote') }}</p>

      <div class="filters">
        <div class="filter">
          <p class="filter-label">{{ t('portals.filterCity') }}</p>
          <div class="chips">
            <button
              type="button"
              class="chip"
              [class.on]="city() === null"
              (click)="city.set(null)"
            >
              {{ t('portals.all') }}
            </button>
            @for (name of cities(); track name) {
              <button type="button" class="chip" [class.on]="city() === name" (click)="city.set(name)">
                {{ name }}
              </button>
            }
          </div>
        </div>

        <div class="filter">
          <p class="filter-label">{{ t('portals.filterIssue') }}</p>
          <div class="chips">
            <button
              type="button"
              class="chip"
              [class.on]="category() === null"
              (click)="category.set(null)"
            >
              {{ t('portals.all') }}
            </button>
            @for (option of categories; track option) {
              <button
                type="button"
                class="chip"
                [class.on]="category() === option"
                (click)="category.set(option)"
              >
                {{ label('chip', option) }}
              </button>
            }
          </div>
        </div>
      </div>

      @if (loading()) {
        <p class="muted">{{ t('portals.loading') }}</p>
      } @else {
        <div class="list">
          @for (portal of visible(); track portal.jurisdiction) {
            <article class="card portal">
              <header class="portal-head">
                <div>
                  <p class="code">{{ portal.jurisdiction }}</p>
                  <h2>{{ portal.name }}</h2>
                </div>
                <span class="serves">{{ serves(portal) }}</span>
              </header>

              <p class="covers">{{ covers(portal.jurisdiction) }}</p>

              <div class="actions">
                <a class="btn-slate link-btn" [href]="portal.web_url" target="_blank" rel="noopener">
                  {{ t('portals.openPortal') }}
                </a>
                @if (portal.app_url) {
                  <a class="btn-ghost link-btn" [href]="portal.app_url" target="_blank" rel="noopener">
                    {{ t('portals.getApp') }}
                  </a>
                }
                <!-- The reason this page earns its place: a phone number that
                     dials, for the night the website is down. -->
                @if (portal.helpline) {
                  <a class="contact" [href]="'tel:' + dial(portal.helpline)">
                    <span aria-hidden="true">📞</span> {{ portal.helpline }}
                  </a>
                }
                @if (portal.whatsapp) {
                  <a
                    class="contact"
                    [href]="'https://wa.me/91' + portal.whatsapp"
                    target="_blank"
                    rel="noopener"
                  >
                    <span aria-hidden="true">💬</span> WhatsApp
                  </a>
                }
              </div>
            </article>
          } @empty {
            <p class="muted">{{ t('portals.none') }}</p>
          }
        </div>

        <div class="card pitch">
          <p class="muted">{{ t('portals.betterWay') }}</p>
          <a class="btn-primary link-btn" routerLink="/">{{ t('portals.fileHere') }}</a>
        </div>
      }
    </div>
  `,
  styles: `
    .lead {
      max-width: 68ch;
      margin-top: -6px;
      margin-bottom: 14px;
    }

    .coverage {
      font-size: 0.88rem;
      padding-left: 12px;
      border-left: 2px solid var(--accent);
      margin-bottom: 24px;
    }

    .filters {
      display: grid;
      gap: 16px;
      margin-bottom: 24px;
    }

    .filter-label {
      margin: 0 0 8px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip {
      border: 1px solid var(--line-strong);
      background: var(--surface-elevated);
      color: var(--ink);
      border-radius: 999px;
      padding: 7px 14px;
      font: inherit;
      font-size: 0.86rem;
      font-weight: 600;
      cursor: pointer;
    }

    .chip:hover,
    .chip:focus-visible {
      border-color: var(--accent);
    }

    .chip.on {
      background: var(--accent);
      border-color: transparent;
      color: var(--ink-inverse);
    }

    .list {
      display: grid;
      gap: 16px;
    }

    @media (min-width: 760px) {
      .list {
        grid-template-columns: 1fr 1fr;
      }

      .filters {
        grid-template-columns: 1fr 1fr;
      }
    }

    .portal-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }

    .code {
      margin: 0 0 4px;
      font-family: var(--font-display);
      font-size: 0.74rem;
      letter-spacing: 0.1em;
      color: var(--accent-strong);
    }

    .portal h2 {
      margin: 0;
      font-size: 1.08rem;
      letter-spacing: -0.01em;
    }

    .serves {
      flex-shrink: 0;
      font-size: 0.76rem;
      font-weight: 600;
      color: var(--ink-muted);
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 3px 10px;
    }

    .covers {
      margin: 12px 0 0;
      color: var(--ink-muted);
      font-size: 0.92rem;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-top: 16px;
    }

    .link-btn {
      display: inline-block;
      text-decoration: none;
      padding: 9px 15px;
      border-radius: var(--radius);
      font-size: 0.88rem;
    }

    /* Sized as a tap target: on a phone this is someone reaching for a call. */
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

    .pitch {
      margin-top: 22px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }

    .pitch p {
      margin: 0;
      max-width: 60ch;
    }
  `,
})
export class PortalDirectoryPage {
  protected readonly i18n = inject(I18nService);
  /** Bound so templates read `t('key')`; repaints when the language changes. */
  protected readonly t = this.i18n.t.bind(this.i18n);
  protected readonly label = this.i18n.label.bind(this.i18n);

  private readonly portals = inject(PortalService);

  protected readonly categories = TICKET_CATEGORIES;
  protected readonly city = signal<string | null>(null);
  protected readonly category = signal<string | null>(null);
  protected readonly loading = signal(true);

  private readonly all = signal<readonly Portal[]>([]);

  /** Cities that actually have a body listed, rather than a hardcoded list. */
  protected readonly cities = computed(() => {
    const names = this.all()
      .map((portal) => portal.city)
      .filter((name): name is string => name !== null);

    return [...new Set(names)];
  });

  protected readonly visible = computed(() => {
    const city = this.city();
    const category = this.category();

    return this.all().filter((portal) => {
      // The national portal answers for every city, so it is never filtered
      // out by one — it is the row that guarantees no empty result.
      const cityMatches = !city || portal.city === city || portal.city === null;
      const categoryMatches = !category || handlesCategory(portal.jurisdiction, category);
      return cityMatches && categoryMatches;
    });
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.all.set(await this.portals.directory());
    } catch {
      // An empty directory renders the "nothing listed" line, which is a
      // truthful thing to show and better than an error the citizen cannot act on.
      this.all.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected covers(jurisdiction: Jurisdiction): string {
    return this.i18n.covers(jurisdiction);
  }

  /** Who a body answers for: a city, a whole state, or the country. */
  protected serves(portal: Portal): string {
    if (portal.city) return portal.city;
    if (portal.state) return this.t('portals.statewide', { state: portal.state });
    return this.t('portals.national');
  }

  /** Strips a published number down to something `tel:` will dial. */
  protected dial(helpline: string): string {
    return helpline.replace(/[^0-9+]/g, '');
  }
}
