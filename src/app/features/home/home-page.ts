import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { MediaService } from '../../core/media.service';
import { TicketsService } from '../../core/tickets.service';
import { PhotoZoom } from '../../shared/photo-zoom';
import { DuplicatePrompt } from '../../shared/duplicate-prompt';
import {
  CATEGORY_OPTIONS,
  DESCRIPTION_LIMIT,
  DESCRIPTION_TEMPLATES,
  DESCRIPTION_TEMPLATES_HI,
  type DuplicateMatch,
  type GrievanceTicket,
  type TicketCategory,
} from '../../core/models';
import { searchPlaces, type Place, type PlaceKind } from '../../core/places';
import { I18nService } from '../../core/i18n.service';
import { PortalHandoff } from '../../shared/portal-handoff';
import { CameraCapture, type CapturedLocation } from '../../shared/camera-capture';
import { MapBackdrop } from '../../shared/map-backdrop';
import { FeedbackLauncher } from '../../shared/feedback-launcher';

@Component({
  selector: 'cp-home-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    CameraCapture,
    MapBackdrop,
    FeedbackLauncher,
    PhotoZoom,
    DuplicatePrompt, PortalHandoff],
  template: `
    <section class="hero">
      <div class="map">
        <cp-map-backdrop />
        <div class="scrim" aria-hidden="true"></div>
      </div>

      <div class="hero-inner">
        <!-- Segmented scope toggle -->
        <div class="segment" role="tablist" [attr.aria-label]="t('home.segmentLabel')">
          <button type="button" role="tab" class="seg active" aria-selected="true">
            <span aria-hidden="true">◈</span> {{ t('home.reportAnIssue') }}
          </button>
          <a class="seg" role="tab" routerLink="/profile" aria-selected="false">
            <span aria-hidden="true">◷</span> {{ t('home.trackResolution') }}
          </a>
        </div>

        <h1>
          {{ t('home.fixYourCampus') }}<br />
          {{ t('home.andCityIssues') }}
        </h1>
        <p class="sub">{{ t('home.heroSub') }}</p>

        <!-- One capsule: campus, issue type, live geotag, then the action. -->
        <div class="capsule">
          <div class="cell campus popover-host">
            <label for="campus">{{ t('home.cityCampus') }}</label>
            <!-- Displays the selection; searching happens in the panel below,
                 so choosing something does not wipe out what you typed. -->
            <input
              id="campus"
              type="text"
              role="combobox"
              readonly
              [attr.aria-expanded]="campusOpen()"
              [placeholder]="t('home.selectPlace')"
              [value]="campus()?.name ?? ''"
              (focus)="openCampus()"
              (click)="openCampus()"
            />

            @if (campusOpen()) {
              <div class="dropdown-card sheet campus-list">
                <!-- Which list you are searching, chosen first. -->
                <div class="kind-tabs" role="tablist" [attr.aria-label]="t('home.searchLabel')">
                  <button
                    type="button"
                    role="tab"
                    class="kind-tab"
                    [class.active]="placeKind() === 'city'"
                    [attr.aria-selected]="placeKind() === 'city'"
                    (click)="setPlaceKind('city')"
                  >
                    {{ t('home.city') }}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    class="kind-tab"
                    [class.active]="placeKind() === 'campus'"
                    [attr.aria-selected]="placeKind() === 'campus'"
                    (click)="setPlaceKind('campus')"
                  >
                    {{ t('home.campus') }}
                  </button>
                </div>

                <div class="search">
                  <span class="search-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="15" height="15">
                      <circle
                        cx="10.5"
                        cy="10.5"
                        r="6.5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                      />
                      <path
                        d="M15.5 15.5 L21 21"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                      />
                    </svg>
                  </span>
                  <input
                    #placeSearch
                    type="search"
                    class="search-input"
                    autocomplete="off"
                    [attr.aria-label]="
                      placeKind() === 'city' ? t('home.searchCities') : t('home.searchCampuses')
                    "
                    [placeholder]="
                      placeKind() === 'city'
                        ? t('home.searchCityPlaceholder')
                        : t('home.searchCampusPlaceholder')
                    "
                    [ngModel]="query()"
                    (ngModelChange)="query.set($event)"
                  />
                  @if (query()) {
                    <button
                      type="button"
                      class="search-clear"
                      [attr.aria-label]="t('home.clearSearch')"
                      (click)="clearQuery()"
                    >
                      ×
                    </button>
                  }
                </div>

                <p class="result-count muted">
                  {{ matches().length }}
                  {{ placeKind() === 'city' ? t('home.citiesCount') : t('home.campusesCount') }}
                </p>

                <div class="place-list" role="listbox">
                  @for (place of matches(); track place.name) {
                    <button
                      type="button"
                      class="dropdown-item"
                      role="option"
                      [attr.aria-selected]="campus()?.name === place.name"
                      (click)="choosePlace(place)"
                    >
                      <span class="item-title">{{ place.name }}</span>
                      <span class="item-sub">{{ place.sub }}</span>
                    </button>
                  } @empty {
                    <p class="empty muted">
                      {{
                        placeKind() === 'campus' ? t('home.noInstitution') : t('home.noCity')
                      }}
                      “{{ query() }}”.
                    </p>
                  }
                </div>
              </div>
            }
          </div>

          <div class="divider" aria-hidden="true"></div>

          <div class="cell popover-host">
            <label id="issue-label">{{ t('home.issue') }}</label>
            <button
              type="button"
              class="cell-btn"
              aria-haspopup="listbox"
              aria-labelledby="issue-label"
              [attr.aria-expanded]="categoryOpen()"
              (click)="toggleCategory()"
            >
              {{ categoryLabel() }} <span class="caret" aria-hidden="true">▾</span>
            </button>

            @if (categoryOpen()) {
              <div class="dropdown-card sheet issue-list" role="listbox">
                @for (option of categories; track option.value) {
                  <button
                    type="button"
                    class="dropdown-item"
                    role="option"
                    [attr.aria-selected]="category() === option.value"
                    (click)="chooseCategoryAndCapture(option.value)"
                  >
                    {{ label('chip', option.value) }}
                  </button>
                }
              </div>
            }
          </div>

          <div class="divider" aria-hidden="true"></div>

          <div class="cell">
            <label>{{ t('report.location') }}</label>
            @if (location(); as fix) {
              <p class="cell-value geo">
                {{ abs(fix.latitude) }}° {{ fix.latitude >= 0 ? 'N' : 'S' }},
                {{ abs(fix.longitude) }}° {{ fix.longitude >= 0 ? 'E' : 'W' }}
              </p>
            } @else {
              <p class="cell-value dim">{{ t('home.lockedOnCapture') }}</p>
            }
          </div>

          <button
            class="shutter"
            type="button"
            [attr.aria-label]="t('home.snapLabel')"
            (click)="startCapture()"
          >
            <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
              <path
                d="M4 8.5h3.2l1.4-2.2h6.8l1.4 2.2H20a1.5 1.5 0 0 1 1.5 1.5v7.5A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5V10A1.5 1.5 0 0 1 4 8.5Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
              <circle cx="12" cy="13.4" r="3.1" fill="none" stroke="currentColor" stroke-width="1.6" />
            </svg>
          </button>
        </div>

        <p class="hint">
          {{ t('home.liveOnly') }}
          <a routerLink="/report">{{ t('home.needFullForm') }}</a>
        </p>

        @if (error(); as message) {
          <p class="alert alert-error hero-alert" role="alert">{{ message }}</p>
        }

        @if (photoUrl(); as preview) {
          <div class="draft">
            <div class="draft-top">
              <img cpZoom class="draft-shot" [src]="preview" [alt]="t('alt.capturedPhoto')" />
              <div class="draft-body">
                <p class="draft-label">{{ t('home.readyToFile') }}</p>
                <p class="draft-meta">
                  {{ categoryLabel() }} · {{ campus()?.name ?? t('home.noPlaceSelected') }}
                </p>
              </div>
            </div>

            <!-- Everything the report still needs, in order. -->
            <div class="details">
              <p class="details-label">{{ t('home.whatKind') }}</p>
              <div class="kinds">
                @for (option of categories; track option.value) {
                  <button
                    type="button"
                    class="kind"
                    [class.active]="category() === option.value"
                    [attr.aria-pressed]="category() === option.value"
                    (click)="chooseCategory(option.value)"
                  >
                    {{ label('chip', option.value) }}
                  </button>
                }
              </div>

              @if (category()) {
                <p class="details-label">{{ t('home.commonReports') }}</p>
                <div class="templates">
                  @for (template of templates(); track template) {
                    <button
                      type="button"
                      class="template"
                      [class.active]="description() === template"
                      (click)="useTemplate(template)"
                    >
                      {{ template }}
                    </button>
                  }
                </div>
              }

              <div class="desc">
                <label for="description">
                  {{ t('home.description') }}
                  <span class="opt">{{ t('home.orWriteOwn') }}</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  [maxlength]="limit"
                  rows="3"
                  [placeholder]="t('home.descPlaceholder')"
                  [ngModel]="description()"
                  (ngModelChange)="description.set($event)"
                ></textarea>
                <p class="count" [class.warn]="remaining() <= 20">
                  {{ description().length }}/{{ limit }}
                </p>
              </div>
            </div>

            <div class="draft-actions">
              @if (blocker(); as reason) {
                <p class="blocker">{{ reason }}</p>
              }
              <button class="ghost-light" type="button" (click)="discard()">
                {{ t('home.discard') }}
              </button>
              <button
                class="gold"
                type="button"
                (click)="file()"
                [disabled]="busy() || !canFile()"
              >
                {{ busy() ? 'Filing…' : 'Submit report' }}
              </button>
            </div>
          </div>
        }

        @if (filed(); as ticket) {
          <div class="draft filed">
            <div class="draft-body">
              <p class="draft-label">{{ t('home.filed') }}</p>
              <p class="ticket-no">{{ ticket.ticket_number }}</p>
              <p class="draft-meta dim">
                {{ t('home.withDesk', { ward: ticket.ward_location }) }}
              </p>
            </div>
            <a class="gold link" routerLink="/profile">{{ t('home.trackIt') }}</a>
          </div>

          <!-- This is where most reports are actually filed, so the handoff
               belongs here too. The card decides for itself whether to appear:
               a campus report is the university's and gets nothing. -->
          <cp-portal-handoff [ticket]="ticket" (tracked)="onPortalTracked($event)" />
        }
      </div>
    </section>

    <!-- Cream half of the palette -->
    <section class="cards">
      <article class="card-tile">
        <div class="tile-art art-a" aria-hidden="true"></div>
        <div class="tile-body">
          <h2>{{ t('home.tileShot') }}</h2>
          <button type="button" class="tile-btn" (click)="startCapture()">
            {{ t('home.snapLabel') }}
          </button>
        </div>
      </article>

      <article class="card-tile">
        <div class="tile-art art-b" aria-hidden="true"></div>
        <div class="tile-body">
          <h2>{{ t('home.tileFiled') }}</h2>
          <a class="tile-btn" routerLink="/profile">{{ t('home.trackAReport') }}</a>
        </div>
      </article>
    </section>

    <cp-feedback-launcher />

    @if (cameraOpen()) {
      <cp-camera-capture
        (captured)="onCaptured($event)"
        (located)="location.set($event)"
        (dismissed)="cameraOpen.set(false)"
      />
    }

      @if (duplicate(); as match) {
        <cp-duplicate-prompt
          [match]="match"
          [busy]="busy()"
          (same)="backExisting()"
          (different)="fileAnyway()"
        />
      }

      @if (backed(); as number) {
        <p class="alert alert-ok" role="status">
          {{ t('home.upvoted', { number }) }}
        </p>
      }
  `,
  styles: `
    :host {
      display: block;
      background: var(--cream);
    }

    /* ================================================================ hero */

    /* No overflow clipping here: the capsule's dropdowns hang past the bottom
       edge of this section, and hiding overflow would cut the list off. The map
       is clipped by .map instead. z-index keeps those dropdowns above the cream
       cards section that follows. */
    .hero {
      position: relative;
      isolation: isolate;
      z-index: 2;
      background: #16242c;
      /* Clears the transparent nav floating over this section. */
      padding: calc(62px + clamp(34px, 8vh, 84px)) 20px clamp(80px, 13vh, 150px);
    }

    /* -------------------------------------------------------- map backdrop */

    .map {
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
      background: #16242c;
    }

    /* Darkens the left, where the headline sits, and the top, under the nav.
       Tinted with the map's own navy rather than green, so the reference
       palette survives the overlay. */
    .scrim {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(
          102deg,
          rgba(9, 17, 22, 0.92) 0%,
          rgba(9, 17, 22, 0.74) 34%,
          rgba(9, 17, 22, 0.36) 68%,
          rgba(9, 17, 22, 0.52) 100%
        ),
        linear-gradient(180deg, rgba(9, 17, 22, 0.8) 0%, transparent 26%),
        linear-gradient(0deg, rgba(9, 17, 22, 0.7) 0%, transparent 24%);
    }

    /* --------------------------------------------------------- hero copy */

    .hero-inner {
      position: relative;
      z-index: 1;
      max-width: 940px;
      margin: 0 auto;
    }

    .segment {
      display: inline-flex;
      gap: 6px;
      padding: 5px;
      border-radius: 999px;
      background: rgba(9, 17, 22, 0.5);
      border: 1px solid rgba(61, 220, 132, 0.2);
      box-shadow: 0 0 20px -4px rgba(61, 220, 132, 0.18);
      backdrop-filter: blur(8px);
      margin-bottom: 30px;
    }

    /* The glyphs carry the glow, so the pills stay quiet until hovered. */
    .seg span {
      color: var(--map-route);
      text-shadow: 0 0 9px rgba(61, 220, 132, 0.75);
    }

    .seg.active span {
      text-shadow: 0 0 7px rgba(61, 220, 132, 0.55);
    }

    .seg {
      border: none;
      background: transparent;
      color: var(--cream-dim);
      font-family: var(--font-body);
      font-weight: 500;
      font-size: 0.88rem;
      padding: 9px 17px;
      border-radius: 999px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      transition: background-color 160ms ease, color 160ms ease;
    }

    .seg:hover {
      color: var(--cream);
      background: rgba(243, 239, 230, 0.08);
    }

    .seg:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(200, 166, 91, 0.35);
    }

    .seg.active {
      background: var(--cream);
      color: var(--green-900);
    }

    h1 {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: clamp(2.5rem, 6.6vw, 4.2rem);
      line-height: 1.06;
      letter-spacing: -0.038em;
      color: var(--cream);
      margin: 0 0 16px;
    }

    .sub {
      color: var(--cream-dim);
      font-size: clamp(1rem, 2vw, 1.14rem);
      margin: 0 0 34px;
      max-width: 46ch;
    }

    /* ------------------------------------------------------------ capsule */

    .capsule {
      display: flex;
      align-items: stretch;
      background: var(--cream);
      border-radius: 999px;
      padding: 7px 7px 7px 10px;
      box-shadow:
        0 1px 2px rgba(2, 24, 15, 0.2),
        0 18px 40px -14px rgba(2, 24, 15, 0.6),
        0 40px 80px -30px rgba(2, 24, 15, 0.7);
    }

    .cell {
      position: relative;
      flex: 1;
      min-width: 0;
      padding: 10px 18px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
    }

    .cell.campus {
      flex: 1.55;
    }

    /* Small uppercase text on the cream capsule needs both the weight and a
       darker ink to stay legible — at 0.7rem the old #7d7566 sat near 3.5:1. */
    .cell label {
      font-size: 0.72rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #57503f;
      font-weight: 800;
    }

    .cell input,
    .cell-btn,
    .cell-value {
      border: none;
      background: transparent;
      padding: 0;
      margin: 0;
      font-family: var(--font-body);
      font-size: 0.97rem;
      font-weight: 700;
      color: var(--green-900);
      width: 100%;
      text-align: left;
      border-radius: 0;
    }

    /* Matches "Select issue" and "Locked on capture": all three cells are in
       their empty state before a report is started, so they must carry equal
       weight. A lighter placeholder here made only this cell look unfinished.
       The warm grey still separates an empty cell from a chosen value, which
       is rendered in near-black green. */
    .cell input::placeholder {
      color: #57503f;
      font-weight: 700;
      opacity: 1;
    }

    .cell input:hover,
    .cell input:focus,
    .cell input:focus-visible {
      border: none;
      box-shadow: none;
      outline: none;
    }

    .cell-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      cursor: pointer;
    }

    .cell-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(5, 96, 57, 0.2);
    }

    .caret {
      font-size: 0.66rem;
      color: #57503f;
    }

    .cell-value {
      font-variant-numeric: tabular-nums;
    }

    /* Same empty-state treatment as the campus placeholder above. */
    .cell-value.dim {
      color: #57503f;
      font-weight: 700;
    }

    .cell-value.geo {
      color: var(--green-600);
    }

    .divider {
      width: 1px;
      background: rgba(2, 24, 15, 0.1);
      margin: 8px 0;
      flex: none;
    }

    .shutter {
      flex: none;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: var(--green-600);
      color: var(--cream);
      display: grid;
      place-items: center;
      border: none;
      align-self: center;
      transition: background-color 160ms ease, transform 90ms ease;
    }

    .shutter:hover {
      background: var(--green-500);
    }

    .shutter:active {
      transform: scale(0.96);
    }

    .shutter:focus-visible {
      outline: none;
      box-shadow: 0 0 0 4px rgba(200, 166, 91, 0.45);
    }

    .sheet {
      top: calc(100% + 14px);
      left: 6px;
      padding: 7px;
    }

    .campus-list {
      right: -40px;
      padding: 8px;
    }

    /* Tabs stay pinned; only the results scroll. */
    .kind-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      background: var(--surface-sunken);
      border-radius: 9px;
      padding: 3px;
      margin-bottom: 8px;
    }

    .kind-tab {
      background: transparent;
      border: none;
      padding: 7px 10px;
      border-radius: 7px;
      font-size: 0.86rem;
      color: var(--ink-muted);
    }

    .kind-tab:hover:not(.active) {
      color: var(--ink-strong);
    }

    .kind-tab.active {
      background: var(--surface-elevated);
      color: var(--ink-strong);
      font-weight: 600;
      box-shadow: 0 1px 2px rgba(18, 24, 26, 0.1);
    }

    .kind-tab:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--accent-soft);
    }

    /* The icon is a flex sibling, not an overlay, so the placeholder can never
       run underneath it however long it is. The border lives on the row and
       the input inside is chromeless. */
    .search {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 0 6px 0 11px;
      background: var(--surface-elevated);
      border: 1px solid var(--line-strong);
      border-radius: 9px;
      margin-bottom: 6px;
      transition:
        border-color 140ms ease,
        box-shadow 140ms ease;
    }

    .search:hover {
      border-color: var(--ink-muted);
    }

    .search:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }

    .search-icon {
      flex: none;
      display: flex;
      color: var(--ink-muted);
    }

    .search-input {
      flex: 1;
      min-width: 0;
      border: none;
      background: transparent;
      border-radius: 0;
      padding: 9px 0;
      font-size: 0.9rem;
    }

    .search-input:hover,
    .search-input:focus,
    .search-input:focus-visible {
      border: none;
      outline: none;
      box-shadow: none;
    }

    /* Chrome draws its own clear button on type="search"; ours is themed. */
    .search-input::-webkit-search-cancel-button {
      display: none;
    }

    .search-clear {
      flex: none;
      background: transparent;
      border: none;
      color: var(--ink-muted);
      font-size: 1.15rem;
      line-height: 1;
      padding: 3px 7px;
      border-radius: 6px;
    }

    .search-clear:hover {
      background: var(--surface-sunken);
      color: var(--ink-strong);
    }

    .search-clear:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--accent-soft);
    }

    .result-count {
      margin: 0 0 4px;
      padding-left: 4px;
      font-size: 0.72rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-weight: 600;
    }

    .place-list {
      max-height: 252px;
      overflow-y: auto;
    }

    .issue-list {
      min-width: 190px;
    }

    /* Matched to the campus list's option weight so the two dropdowns either
       side of the capsule read as one control. Scoped to this list rather than
       set on .dropdown-item globally, which would also reweight the profile
       menu and the region search in the nav. */
    .issue-list .dropdown-item {
      font-weight: 700;
      color: var(--ink-strong);
    }

    /* The institution list is long and the names are similar ("University of
       Delhi — North Campus" vs "— South Campus"), so the title carries real
       weight and the sub line stays readable rather than decorative: it is the
       city and pincode, which is often the only thing telling two entries
       apart. */
    .item-title {
      display: block;
      color: var(--ink-strong);
      font-weight: 700;
    }

    .item-sub {
      display: block;
      font-size: 0.8rem;
      color: var(--ink);
      font-weight: 600;
    }

    .empty {
      padding: 12px;
      margin: 0;
      font-size: 0.88rem;
    }

    .hint {
      color: rgba(243, 239, 230, 0.5);
      font-size: 0.84rem;
      margin: 16px 0 0;
      padding-left: 22px;
    }

    .hint a {
      color: var(--gold);
      text-decoration: none;
      border-bottom: 1px solid var(--gold-soft);
    }

    .hint a:hover {
      border-bottom-color: var(--gold);
    }

    .hero-alert {
      margin-top: 18px;
    }

    /* ------------------------------------------------------------- draft */

    .draft {
      margin-top: 26px;
      padding: 16px;
      border-radius: var(--radius-lg);
      background: rgba(9, 17, 22, 0.66);
      border: 1px solid rgba(61, 220, 132, 0.22);
      backdrop-filter: blur(8px);
    }

    .draft-top {
      display: flex;
      align-items: center;
      gap: 18px;
      flex-wrap: wrap;
    }

    .draft-shot {
      width: 128px;
      height: 92px;
      object-fit: cover;
      border-radius: var(--radius);
      border: 1px solid rgba(160, 226, 190, 0.2);
    }

    .draft-body {
      flex: 1;
      min-width: 200px;
    }

    .draft-label {
      font-size: 0.7rem;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--gold);
      margin: 0 0 3px;
      font-weight: 600;
    }

    .draft-meta {
      margin: 0;
      color: var(--cream);
      font-weight: 500;
    }

    .draft-meta.dim {
      color: var(--cream-dim);
      font-weight: 400;
      font-size: 0.87rem;
    }

    .ticket-no {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--cream);
      margin: 0 0 3px;
    }

    .draft-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      margin-top: 16px;
    }

    /* Says why the button is dead, rather than leaving it inert and unexplained. */
    .blocker {
      margin: 0 auto 0 0;
      font-size: 0.83rem;
      color: var(--gold);
    }

    .gold:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .kinds {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-bottom: 18px;
    }

    .kind {
      background: rgba(243, 239, 230, 0.05);
      border: 1px solid rgba(243, 239, 230, 0.14);
      color: var(--cream-dim);
      font-size: 0.86rem;
      font-weight: 500;
      padding: 8px 14px;
      border-radius: 999px;
    }

    .kind:hover {
      background: rgba(243, 239, 230, 0.1);
      color: var(--cream);
      border-color: rgba(61, 220, 132, 0.4);
    }

    .kind:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(61, 220, 132, 0.3);
    }

    .kind.active {
      background: rgba(61, 220, 132, 0.16);
      border-color: rgba(61, 220, 132, 0.7);
      color: var(--cream);
      font-weight: 600;
    }

    /* -------------------------------------------------- templates + notes */

    .details {
      margin-top: 16px;
      padding-top: 15px;
      border-top: 1px solid rgba(61, 220, 132, 0.16);
    }

    .details-label {
      font-size: 0.72rem;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: rgba(243, 239, 230, 0.5);
      margin: 0 0 10px;
      font-weight: 600;
    }

    .templates {
      display: grid;
      gap: 7px;
      margin-bottom: 16px;
    }

    .template {
      text-align: left;
      background: rgba(243, 239, 230, 0.05);
      border: 1px solid rgba(243, 239, 230, 0.12);
      color: var(--cream-dim);
      font-weight: 400;
      font-size: 0.88rem;
      line-height: 1.4;
      padding: 10px 13px;
      border-radius: 10px;
    }

    .template:hover {
      background: rgba(243, 239, 230, 0.09);
      color: var(--cream);
      border-color: rgba(61, 220, 132, 0.4);
    }

    .template:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(61, 220, 132, 0.3);
    }

    .template.active {
      background: rgba(61, 220, 132, 0.12);
      border-color: rgba(61, 220, 132, 0.65);
      color: var(--cream);
    }

    .desc label {
      display: block;
      font-size: 0.72rem;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: rgba(243, 239, 230, 0.5);
      font-weight: 600;
      margin-bottom: 6px;
    }

    .opt {
      letter-spacing: 0.04em;
      text-transform: none;
      font-weight: 400;
      color: rgba(243, 239, 230, 0.36);
    }

    .desc textarea {
      background: rgba(9, 17, 22, 0.6);
      border-color: rgba(243, 239, 230, 0.16);
      color: var(--cream);
      font-size: 0.92rem;
      min-height: 74px;
    }

    .desc textarea::placeholder {
      color: rgba(243, 239, 230, 0.34);
    }

    .desc textarea:hover {
      border-color: rgba(243, 239, 230, 0.3);
    }

    .desc textarea:focus-visible {
      border-color: rgba(61, 220, 132, 0.6);
      box-shadow: 0 0 0 3px rgba(61, 220, 132, 0.18);
    }

    .count {
      margin: 5px 0 0;
      text-align: right;
      font-size: 0.76rem;
      color: rgba(243, 239, 230, 0.4);
      font-variant-numeric: tabular-nums;
    }

    .count.warn {
      color: var(--gold);
    }

    .ghost-light {
      background: transparent;
      border: 1px solid rgba(243, 239, 230, 0.28);
      color: var(--cream);
    }

    .ghost-light:hover {
      background: rgba(243, 239, 230, 0.1);
    }

    .gold {
      background: var(--gold);
      border: none;
      color: var(--green-950);
      text-decoration: none;
    }

    .gold:hover:not(:disabled) {
      background: #d8bc74;
    }

    .gold.link {
      padding: 11px 18px;
      border-radius: var(--radius);
      font-weight: 600;
      display: inline-block;
    }

    /* =============================================================== cards */

    .cards {
      max-width: 1080px;
      margin: 0 auto;
      padding: clamp(46px, 8vh, 88px) 20px clamp(56px, 9vh, 96px);
      display: grid;
      gap: 22px;
      grid-template-columns: 1fr;
    }

    @media (min-width: 780px) {
      .cards {
        grid-template-columns: 1fr 1fr;
      }
    }

    /* Glowing edge: a hairline in the map's route green, lifted off the cream
       by an outer bloom and an inner highlight along the top. */
    .card-tile {
      position: relative;
      overflow: hidden;
      border-radius: 20px;
      min-height: 300px;
      display: flex;
      align-items: flex-end;
      border: 1px solid rgba(61, 220, 132, 0.34);
      box-shadow:
        0 0 0 1px rgba(61, 220, 132, 0.08),
        inset 0 1px 0 rgba(61, 220, 132, 0.28),
        0 0 26px -2px rgba(61, 220, 132, 0.22),
        0 20px 44px -20px rgba(9, 17, 22, 0.5);
      transition: border-color 200ms ease, box-shadow 200ms ease;
    }

    .card-tile:hover,
    .card-tile:focus-within {
      border-color: rgba(61, 220, 132, 0.6);
      box-shadow:
        0 0 0 1px rgba(61, 220, 132, 0.16),
        inset 0 1px 0 rgba(61, 220, 132, 0.44),
        0 0 40px -2px rgba(61, 220, 132, 0.38),
        0 22px 48px -20px rgba(9, 17, 22, 0.55);
    }

    /* Same map language as the hero, reduced to a texture: road-coloured
       hairlines over the backdrop's own land and vegetation greens. */
    .tile-art {
      position: absolute;
      inset: 0;
      background-image:
        repeating-linear-gradient(
          90deg,
          rgba(95, 109, 132, 0.16) 0 1px,
          transparent 1px 46px
        ),
        repeating-linear-gradient(0deg, rgba(95, 109, 132, 0.16) 0 1px, transparent 1px 46px);
    }

    .art-a {
      background-color: var(--map-green);
      box-shadow:
        inset 0 -140px 120px -80px rgba(7, 15, 19, 0.95),
        inset 120px 80px 170px -90px rgba(61, 220, 132, 0.2);
    }

    .art-b {
      background-color: var(--map-land);
      box-shadow:
        inset 0 -140px 120px -80px rgba(7, 15, 19, 0.95),
        inset -120px 60px 170px -90px rgba(23, 64, 58, 0.9);
    }

    .tile-body {
      position: relative;
      padding: 26px;
    }

    .tile-body h2 {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.4rem;
      line-height: 1.22;
      letter-spacing: -0.028em;
      color: var(--cream);
      margin: 0 0 18px;
    }

    .tile-btn {
      display: inline-block;
      background: var(--cream);
      color: var(--green-900);
      border: none;
      border-radius: 999px;
      padding: 11px 20px;
      font-weight: 600;
      text-decoration: none;
      font-size: 0.92rem;
    }

    .tile-btn:hover {
      background: #fff;
    }

    .tile-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(200, 166, 91, 0.5);
    }

    /* ------------------------------------------------------------ mobile */

    @media (max-width: 860px) {
      .capsule {
        flex-direction: column;
        border-radius: 26px;
        padding: 8px;
        align-items: stretch;
      }

      .divider {
        width: auto;
        height: 1px;
        margin: 0 16px;
      }

      .shutter {
        width: 100%;
        border-radius: 18px;
        height: 52px;
        margin-top: 6px;
      }

      .campus-list {
        right: 6px;
      }

      .hint {
        padding-left: 0;
      }
    }
  `,
})
export class HomePage {
  protected readonly i18n = inject(I18nService);
  /** Bound so templates read `t('key')`; repaints when the language changes. */
  protected readonly t = this.i18n.t.bind(this.i18n);
  /** For values stored in English: the category chips. */
  protected readonly label = this.i18n.label.bind(this.i18n);

  private readonly tickets = inject(TicketsService);
  private readonly media = inject(MediaService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly categories = CATEGORY_OPTIONS;

  /**
   * A signal, not a plain field: `matches` is a computed, so a non-reactive
   * property would leave it serving a stale, cached list while you typed.
   */
  protected readonly query = signal('');
  protected readonly campusOpen = signal(false);
  // Defaults to the first tab, matching the "City / Campus" label order.
  protected readonly placeKind = signal<PlaceKind>('city');
  protected readonly campus = signal<Place | null>(null);

  protected readonly categoryOpen = signal(false);
  protected readonly category = signal<TicketCategory | null>(null);

  protected readonly limit = DESCRIPTION_LIMIT;
  protected readonly description = signal('');

  protected readonly location = signal<CapturedLocation | null>(null);
  protected readonly cameraOpen = signal(false);

  protected readonly photoUrl = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly filed = signal<GrievanceTicket | null>(null);

  /** A nearby open report the draft may be a duplicate of; drives the prompt. */
  protected readonly duplicate = signal<DuplicateMatch | null>(null);
  /** Ticket number the citizen backed instead of filing, for the confirmation. */
  protected readonly backed = signal<string | null>(null);

  private photo: File | null = null;

  private readonly placeSearch = viewChild<ElementRef<HTMLInputElement>>('placeSearch');

  protected readonly matches = computed(() => searchPlaces(this.placeKind(), this.query()));

  /** Hindi openers when the app is in Hindi: the text lands in the complaint. */
  protected readonly templates = computed(() => {
    const value = this.category();
    if (!value) return [];
    return this.i18n.lang() === 'hi'
      ? DESCRIPTION_TEMPLATES_HI[value]
      : DESCRIPTION_TEMPLATES[value];
  });

  protected readonly remaining = computed(() => DESCRIPTION_LIMIT - this.description().length);

  /**
   * Submission stays locked until the report is actually actionable. A ticket
   * with no campus cannot be routed and one with no description is a photo with
   * no complaint attached, so both are required rather than merely validated on
   * click.
   */
  protected readonly blocker = computed(() => {
    if (!this.campus()) return 'Pick your city or campus above to continue.';
    if (!this.category()) return 'Choose what kind of issue this is.';
    if (this.description().trim().length === 0) {
      return 'Tap a suggestion or write a short description.';
    }
    return null;
  });

  protected readonly canFile = computed(() => this.photoUrl() !== null && this.blocker() === null);

  /** Reads the language signal, so the capsule relabels itself on a switch. */
  /** The citizen came back with the portal's number; reflect it immediately. */
  protected onPortalTracked(reference: string): void {
    const ticket = this.filed();
    if (!ticket) return;

    this.filed.set({ ...ticket, portal_reference_id: reference, portal_status: 'submitted' });
  }

  protected readonly categoryLabel = computed(() => {
    const value = this.category();
    if (!value) return this.i18n.t('home.selectIssue');
    return this.i18n.label('chip', value);
  });

  constructor() {
    // The nav's "Snap Live Photo" lands here with ?snap=1 and goes straight in.
    if (this.route.snapshot.queryParamMap.get('snap')) {
      queueMicrotask(() => this.startCapture());
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.popover-host')) {
      this.campusOpen.set(false);
      this.categoryOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.campusOpen.set(false);
    this.categoryOpen.set(false);
  }

  protected abs(value: number): string {
    return Math.abs(value).toFixed(4);
  }

  protected openCampus(): void {
    if (this.campusOpen()) return;

    this.campusOpen.set(true);
    this.categoryOpen.set(false);

    // Land the caret in the search box so typing filters straight away, once
    // the panel has actually rendered.
    queueMicrotask(() => this.placeSearch()?.nativeElement.focus());
  }

  /** Switching lists clears the query and any selection from the other one. */
  protected setPlaceKind(kind: PlaceKind): void {
    if (this.placeKind() === kind) return;

    this.placeKind.set(kind);
    this.query.set('');
    this.campus.set(null);
    this.placeSearch()?.nativeElement.focus();
  }

  protected clearQuery(): void {
    this.query.set('');
    this.placeSearch()?.nativeElement.focus();
  }

  protected choosePlace(place: Place): void {
    this.campus.set(place);
    this.query.set('');
    this.campusOpen.set(false);
  }

  protected toggleCategory(): void {
    this.categoryOpen.update((open) => !open);
    this.campusOpen.set(false);
  }

  /**
   * Picking an issue from the capsule is the start of filing one, so it goes
   * straight into capture rather than leaving the choice sitting there doing
   * nothing. Once a photo exists the same choice only re-categorises the draft
   * — reopening the camera would throw the shot away.
   */
  protected chooseCategoryAndCapture(value: TicketCategory): void {
    this.chooseCategory(value);
    if (!this.photoUrl()) this.startCapture();
  }

  protected chooseCategory(value: TicketCategory): void {
    const previous = this.category();
    this.category.set(value);
    this.categoryOpen.set(false);

    // A template from the old category would now describe the wrong thing.
    // Anything typed by hand is left alone.
    if (previous && previous !== value && this.isTemplate(previous, this.description())) {
      this.description.set('');
    }
  }

  /** Replaces the description, so tapping a second suggestion swaps cleanly. */
  protected useTemplate(template: string): void {
    this.description.set(this.description() === template ? '' : template);
  }

  private isTemplate(category: TicketCategory, text: string): boolean {
    // Either language counts: the citizen may have switched after tapping one.
    return (
      DESCRIPTION_TEMPLATES[category].includes(text) ||
      DESCRIPTION_TEMPLATES_HI[category].includes(text)
    );
  }

  /**
   * Filing needs an account, and losing a freshly taken photo to a sign-in
   * redirect would be worse than asking first — so the gate comes before the
   * camera, not after.
   */
  protected startCapture(): void {
    this.error.set(null);

    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/auth'], { queryParams: { redirect: '/' } });
      return;
    }

    this.filed.set(null);
    this.cameraOpen.set(true);
  }

  protected onCaptured(file: File): void {
    this.photo = file;

    const previous = this.photoUrl();
    if (previous) URL.revokeObjectURL(previous);
    this.photoUrl.set(URL.createObjectURL(file));

    this.cameraOpen.set(false);
  }

  protected discard(): void {
    this.photo = null;
    const url = this.photoUrl();
    if (url) URL.revokeObjectURL(url);
    this.photoUrl.set(null);
    this.description.set('');
  }

  /**
   * Checks for an open report of the same kind nearby before filing.
   *
   * The check happens before the photo is uploaded: if this turns out to be a
   * duplicate, there is no reason to have put a second copy of the same pothole
   * in storage.
   */
  protected async file(): Promise<void> {
    if (!this.photo || this.busy() || !this.canFile()) return;

    this.busy.set(true);
    this.error.set(null);

    try {
      const fix = this.location();
      const match = await this.tickets.findDuplicate(
        this.category()!,
        fix?.latitude ?? null,
        fix?.longitude ?? null,
        fix?.accuracy ?? null,
      );

      if (match) {
        this.duplicate.set(match);
        return;
      }

      await this.createTicket();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not file the report.');
    } finally {
      this.busy.set(false);
    }
  }

  /** "Yes, same problem" — back the existing report instead of filing again. */
  protected async backExisting(): Promise<void> {
    const match = this.duplicate();
    if (!match || this.busy()) return;

    this.busy.set(true);
    this.error.set(null);

    try {
      await this.tickets.upvote(match.id);
      this.backed.set(match.ticket_number);
      this.duplicate.set(null);
      this.discard();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not add your upvote.');
      this.duplicate.set(null);
    } finally {
      this.busy.set(false);
    }
  }

  /** "Mine is different" — the citizen overrules the proximity guess. */
  protected async fileAnyway(): Promise<void> {
    this.duplicate.set(null);
    this.busy.set(true);

    try {
      await this.createTicket();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not file the report.');
    } finally {
      this.busy.set(false);
    }
  }

  private async createTicket(): Promise<void> {
    const campus = this.campus()!;
    const fix = this.location();

    // The capture flow will not hand back a draft without coordinates, so this
    // only fires if something upstream changed. Better a clear refusal than a
    // report a crew cannot be sent to.
    if (!fix) {
      throw new Error('This report has no location. Retake the photo to capture one.');
    }

    const imageUrl = await this.media.upload(this.photo!, 'reports');

    const ticket = await this.tickets.create({
      category: this.category()!,
      ward_location: campus.name,
      image_url: imageUrl,
      description: this.description().trim().slice(0, DESCRIPTION_LIMIT) || null,
      latitude: fix.latitude,
      longitude: fix.longitude,
      location_accuracy_m: Math.round(fix.accuracy),
    });

    this.filed.set(ticket);
    this.discard();
  }
}
