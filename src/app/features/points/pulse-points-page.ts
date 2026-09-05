import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PointsService } from '../../core/points.service';
import { POINTS_PER_REPORT, type PulsePointEvent, type Redemption, type Reward } from '../../core/models';

/**
 * The citizen's Pulse Points wallet.
 *
 * Points are earned only when the ward desk approves a campus report — filing
 * one pays nothing. That rule lives in the database; this page just explains it
 * and shows what it produced, because a reward scheme people cannot predict is
 * one they stop trusting.
 */
@Component({
  selector: 'cp-pulse-points-page',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="page">
      <header class="head">
        <div>
          <h1>Pulse Points</h1>
          <p class="muted">
            {{ POINTS_PER_REPORT }} points every time the ward desk approves one of your campus
            reports.
          </p>
        </div>
        <a class="btn-ghost link-btn" routerLink="/report">File a report</a>
      </header>

      @if (error(); as message) {
        <p class="alert alert-error" role="alert">{{ message }}</p>
      }

      @if (issued(); as win) {
        <div class="alert alert-ok" role="status">
          <strong>{{ win.title }} redeemed.</strong>
          @if (win.code) {
            Your code is <code class="code">{{ win.code }}</code> — it is saved below too.
          } @else {
            Codes are out of stock right now, so this is queued; it will appear below as soon as
            it is issued.
          }
        </div>
      }

      <!-- The wallet ---------------------------------------------------- -->
      <section class="wallet card">
        <div class="coin" aria-hidden="true">
          <svg viewBox="0 0 88 88" width="88" height="88">
            <defs>
              <linearGradient id="coinFace" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#f5d98a" />
                <stop offset="45%" stop-color="#d8ae4e" />
                <stop offset="100%" stop-color="#a97c22" />
              </linearGradient>
              <linearGradient id="coinRim" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#ffeab5" />
                <stop offset="100%" stop-color="#8a6317" />
              </linearGradient>
            </defs>
            <circle cx="44" cy="44" r="42" fill="url(#coinRim)" />
            <circle cx="44" cy="44" r="35" fill="url(#coinFace)" />
            <circle cx="44" cy="44" r="35" fill="none" stroke="#8a6317" stroke-width="1.2" opacity="0.5" />
            <!-- A pulse trace, the same idea as the product name. -->
            <path
              d="M24 45h8l5-11 7 22 6-13 4 6h10"
              fill="none"
              stroke="#5c400d"
              stroke-width="3.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>

        <div class="wallet-body">
          <p class="wallet-label">Your balance</p>
          @if (loading()) {
            <p class="balance">—</p>
          } @else {
            <p class="balance">{{ balance() }}<span class="unit">points</span></p>
          }

          @if (nextReward(); as next) {
            <div class="progress" role="img" [attr.aria-label]="progressLabel()">
              <div class="bar"><span [style.width.%]="progressPct()"></span></div>
              <p class="muted progress-text">
                {{ remaining() }} more {{ remaining() === 1 ? 'point' : 'points' }} to reach
                {{ next }} — about
                {{ reportsToNext() }} more approved
                {{ reportsToNext() === 1 ? 'report' : 'reports' }}.
              </p>
            </div>
          } @else if (!loading()) {
            <p class="muted progress-text">
              You have enough for every reward on offer. Redeem one below.
            </p>
          }
        </div>
      </section>

      <!-- Rewards ------------------------------------------------------- -->
      <h2 class="section">Rewards</h2>
      @if (rewards().length === 0 && !loading()) {
        <p class="muted">No rewards are on offer right now.</p>
      }
      <div class="rewards">
        @for (reward of rewards(); track reward.key) {
          <article class="card reward" [class.locked]="balance() < reward.cost">
            <p class="cost">{{ reward.cost }} pts</p>
            <h3>{{ reward.title }}</h3>
            @if (reward.description) {
              <p class="muted desc">{{ reward.description }}</p>
            }
            <button
              type="button"
              class="btn-primary"
              [disabled]="balance() < reward.cost || redeeming() !== null"
              (click)="redeem(reward)"
            >
              @if (redeeming() === reward.key) {
                Redeeming…
              } @else if (balance() < reward.cost) {
                {{ reward.cost - balance() }} points short
              } @else {
                Redeem
              }
            </button>
          </article>
        }
      </div>

      <!-- What you have claimed ----------------------------------------- -->
      @if (redemptions().length > 0) {
        <h2 class="section">Your rewards</h2>
        <div class="card claims">
          @for (claim of redemptions(); track claim.id) {
            <div class="claim">
              <div>
                <p class="claim-title">{{ titleFor(claim.reward_key) }}</p>
                <p class="muted claim-meta">
                  {{ claim.created_at | date: 'd MMM y' }} · {{ claim.cost }} points
                </p>
              </div>
              @if (claim.code) {
                <code class="code">{{ claim.code }}</code>
              } @else {
                <span class="pill pill-progress">Awaiting code</span>
              }
            </div>
          }
        </div>
      }

      <!-- Ledger --------------------------------------------------------- -->
      <h2 class="section">History</h2>
      @if (loading()) {
        <p class="muted">Loading…</p>
      } @else if (ledger().length === 0) {
        <div class="card empty">
          <p class="muted">
            Nothing yet. File a report on your campus — once the ward desk approves it, your first
            {{ POINTS_PER_REPORT }} points land here.
          </p>
        </div>
      } @else {
        <div class="card ledger">
          @for (row of ledger(); track row.id) {
            <div class="entry">
              <span class="delta" [class.spend]="row.delta < 0">
                {{ row.delta > 0 ? '+' : '' }}{{ row.delta }}
              </span>
              <span class="reason">{{ row.reason }}</span>
              <span class="muted when">{{ row.created_at | date: 'd MMM y' }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 22px;
    }

    .head h1 {
      margin-bottom: 2px;
    }

    .head p {
      margin: 0;
      max-width: 52ch;
    }

    .link-btn {
      text-decoration: none;
      white-space: nowrap;
    }

    .section {
      margin: 30px 0 14px;
      font-size: 1.05rem;
    }

    /* ------------------------------------------------------------- wallet */

    .wallet {
      display: flex;
      align-items: center;
      gap: 22px;
      flex-wrap: wrap;
      background: linear-gradient(135deg, var(--green-900), var(--green-700));
      border-color: var(--green-line);
    }

    .coin {
      filter: drop-shadow(0 6px 14px rgba(2, 24, 15, 0.55));
      flex-shrink: 0;
    }

    .wallet-body {
      flex: 1;
      min-width: 220px;
    }

    .wallet-label {
      margin: 0;
      font-size: 0.74rem;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--cream-dim);
      font-weight: 700;
    }

    .balance {
      margin: 2px 0 0;
      font-family: var(--font-display);
      font-size: clamp(2.4rem, 7vw, 3.4rem);
      font-weight: 800;
      line-height: 1.05;
      letter-spacing: -0.04em;
      color: var(--cream);
      font-variant-numeric: tabular-nums;
    }

    .unit {
      font-size: 0.9rem;
      font-weight: 600;
      letter-spacing: 0;
      color: var(--cream-dim);
      margin-left: 9px;
    }

    .progress {
      margin-top: 14px;
    }

    .bar {
      height: 7px;
      border-radius: 999px;
      background: rgba(243, 239, 230, 0.16);
      overflow: hidden;
    }

    .bar span {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #d8ae4e, #f5d98a);
      transition: width 0.35s ease;
    }

    .progress-text {
      margin: 8px 0 0;
      font-size: 0.84rem;
      color: var(--cream-dim);
    }

    /* ------------------------------------------------------------ rewards */

    .rewards {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(auto-fit, minmax(215px, 1fr));
    }

    .reward {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .reward.locked {
      opacity: 0.72;
    }

    .cost {
      margin: 0;
      font-family: var(--font-display);
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: var(--accent-strong);
    }

    .reward h3 {
      margin: 0;
      font-size: 1.05rem;
    }

    .desc {
      margin: 0 0 12px;
      font-size: 0.85rem;
      flex: 1;
    }

    /* ------------------------------------------------- claims and ledger */

    .claims,
    .ledger {
      padding: 0;
    }

    .claim,
    .entry {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--line);
    }

    .claim:last-child,
    .entry:last-child {
      border-bottom: none;
    }

    .claim {
      justify-content: space-between;
    }

    .claim-title {
      margin: 0;
      font-weight: 600;
      color: var(--ink-strong);
    }

    .claim-meta {
      margin: 0;
      font-size: 0.8rem;
    }

    .code {
      font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
      font-size: 0.86rem;
      letter-spacing: 0.06em;
      background: var(--accent-soft);
      color: var(--accent-strong);
      border-radius: 7px;
      padding: 4px 9px;
      user-select: all;
    }

    .delta {
      font-family: var(--font-display);
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      color: var(--accent-strong);
      min-width: 44px;
    }

    .delta.spend {
      color: var(--danger);
    }

    .reason {
      flex: 1;
      min-width: 0;
    }

    .when {
      font-size: 0.8rem;
      white-space: nowrap;
    }

    .empty {
      text-align: center;
    }

    .empty p {
      margin: 0;
    }
  `,
})
export class PulsePointsPage {
  private readonly service = inject(PointsService);

  protected readonly POINTS_PER_REPORT = POINTS_PER_REPORT;

  protected readonly balance = signal(0);
  protected readonly ledger = signal<PulsePointEvent[]>([]);
  protected readonly rewards = signal<Reward[]>([]);
  protected readonly redemptions = signal<Redemption[]>([]);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly redeeming = signal<string | null>(null);
  protected readonly issued = signal<{ title: string; code: string | null } | null>(null);

  /** The cheapest reward still out of reach — what the bar is filling towards. */
  private readonly nextTier = computed(() => {
    const costs = this.rewards()
      .map((reward) => reward.cost)
      .filter((cost) => cost > this.balance())
      .sort((a, b) => a - b);
    return costs[0] ?? null;
  });

  protected readonly nextReward = computed(() => this.nextTier());
  protected readonly remaining = computed(() => Math.max(0, (this.nextTier() ?? 0) - this.balance()));

  protected readonly reportsToNext = computed(() =>
    Math.ceil(this.remaining() / POINTS_PER_REPORT),
  );

  protected readonly progressPct = computed(() => {
    const target = this.nextTier();
    if (!target) return 100;
    return Math.min(100, Math.round((this.balance() / target) * 100));
  });

  protected readonly progressLabel = computed(
    () => `${this.balance()} of ${this.nextTier() ?? this.balance()} points`,
  );

  constructor() {
    void this.load();
  }

  protected titleFor(key: string): string {
    return this.rewards().find((reward) => reward.key === key)?.title ?? key;
  }

  protected async redeem(reward: Reward): Promise<void> {
    this.redeeming.set(reward.key);
    this.error.set(null);
    this.issued.set(null);

    try {
      const result = await this.service.redeem(reward.key);
      this.issued.set({ title: result.title, code: result.code });
      // Reload rather than adjusting locally: the server is the authority on
      // the balance, and it has just written two rows we do not have.
      await this.load();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not redeem that reward.');
    } finally {
      this.redeeming.set(null);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      const [balance, ledger, rewards, redemptions] = await Promise.all([
        this.service.balance(),
        this.service.ledger(),
        this.service.rewards(),
        this.service.redemptions(),
      ]);

      this.balance.set(balance);
      this.ledger.set(ledger);
      this.rewards.set(rewards);
      this.redemptions.set(redemptions);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not load your Pulse Points.');
    } finally {
      this.loading.set(false);
    }
  }
}
