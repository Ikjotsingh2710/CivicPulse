import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService, formatPhone } from './core/auth.service';
import { TicketsService } from './core/tickets.service';
import { PhotoLightbox } from './shared/photo-lightbox';
import { ReportToast } from './shared/report-toast';
import { NotificationsService } from './core/notifications.service';
import { I18nService } from './core/i18n.service';
import { UpdatesService } from './core/updates.service';

type RegionMode = 'city' | 'pincode';

@Component({
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    PhotoLightbox,
    ReportToast,
  ],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly i18n = inject(I18nService);
  /**
   * Bound so templates can write `t('key')` rather than `i18n.t('key')`.
   * It reads the language signal, so every view using it repaints on a switch.
   */
  protected readonly t = this.i18n.t.bind(this.i18n);
  /** For statuses stored in English, shown in the updates line. */
  protected readonly label = this.i18n.label.bind(this.i18n);

  protected readonly auth = inject(AuthService);
  protected readonly notifications = inject(NotificationsService);
  protected readonly updates = inject(UpdatesService);
  private readonly tickets = inject(TicketsService);
  private readonly router = inject(Router);

  protected readonly phoneDisplay = computed(() => formatPhone(this.auth.phone()));

  protected readonly counts = signal({ active: 0, resolved: 0 });
  protected readonly countsLoading = signal(false);
  protected readonly countsError = signal<string | null>(null);

  /** The auth screen is its own full-bleed layout; the bar would fight it. */
  protected readonly showNav = signal(true);

  /** On the home hero the bar floats over dark green and inverts its palette. */
  protected readonly onDark = signal(true);

  protected readonly profileOpen = signal(false);
  protected readonly regionOpen = signal(false);
  protected readonly regionMode = signal<RegionMode>('city');
  protected regionQuery = '';

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const url = event.urlAfterRedirects;
        this.showNav.set(!url.startsWith('/auth'));
        this.onDark.set(url === '/' || url.startsWith('/?'));
        this.profileOpen.set(false);
        this.regionOpen.set(false);
      }
    });
  }

  /** Any click that did not land inside an open popover closes it. */
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.popover-host')) {
      this.profileOpen.set(false);
      this.regionOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.profileOpen.set(false);
    this.regionOpen.set(false);
  }

  protected toggleProfile(): void {
    const opening = !this.profileOpen();
    this.profileOpen.set(opening);
    this.regionOpen.set(false);

    // Refetched on every open so the totals cannot go stale behind the panel.
    if (opening && this.auth.isAuthenticated()) {
      void this.loadCounts();
      void this.notifications.refresh();
    }
  }

  private async loadCounts(): Promise<void> {
    this.countsLoading.set(true);
    this.countsError.set(null);

    try {
      this.counts.set(await this.tickets.myCounts());
    } catch (error) {
      this.countsError.set(error instanceof Error ? error.message : 'Could not load totals.');
    } finally {
      this.countsLoading.set(false);
    }
  }

  protected toggleRegion(): void {
    this.regionOpen.update((open) => !open);
    this.profileOpen.set(false);
  }

  protected setRegionMode(mode: RegionMode): void {
    this.regionMode.set(mode);
    this.regionQuery = '';
  }

  protected searchRegion(): void {
    const query = this.regionQuery.trim();
    if (!query) return;

    this.regionOpen.set(false);
    void this.router.navigate(['/issues'], {
      queryParams: { [this.regionMode()]: query },
    });
  }

  /** Sends the user home with the camera already opening. */
  protected snapLivePhoto(): void {
    void this.router.navigate(['/'], { queryParams: { snap: 1 } });
  }

  protected async signOut(): Promise<void> {
    this.profileOpen.set(false);
    await this.auth.signOut();
    await this.router.navigateByUrl('/auth');
  }
}
