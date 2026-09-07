import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { I18nService } from '../core/i18n.service';
import {
  EXACT_ACCURACY_M,
  REQUIRED_ACCURACY_M,
  explainGeolocationError,
  watchBestFix,
} from '../core/geolocate';
import { inspectImage, type ImageVerdict } from '../core/image-check';

export interface CapturedLocation {
  latitude: number;
  longitude: number;
  /**
   * Radius of uncertainty in metres. Not optional: a fix only leaves this
   * component once the device has actually produced one, so there is always a
   * number — even when that number is large.
   */
  accuracy: number;
  /** False when this locates an area rather than a spot. Travels to the desk. */
  precise: boolean;
}

type Stage =
  | 'camera-consent'
  | 'starting'
  | 'live'
  | 'review'
  | 'location-consent'
  | 'locating'
  /** A fix exists but only names an area; the citizen chooses what to do. */
  | 'location-coarse'
  | 'location-failed'
  | 'error';

/**
 * Live-camera capture, presented as a modal.
 *
 * Deliberately offers no file input: a report is only trustworthy if the photo
 * was taken at the scene, so the gallery is never an option.
 *
 * Permissions are asked for one at a time, each immediately before it is
 * needed — camera to take the shot, then location once a shot exists. Two
 * native prompts arriving together is what makes people deny both; asking for
 * the location after the photo also means the fix is taken where the photo was.
 */
@Component({
  selector: 'cp-camera-capture',
  standalone: true,
  template: `
    <div class="scrim" role="dialog" aria-modal="true" [attr.aria-label]="t('camera.dialogLabel')">
      <div class="sheet">
        @switch (stage()) {
          @case ('camera-consent') {
            <p class="step">{{ t('camera.step1') }}</p>
            <h2>{{ t('camera.useCamera') }}</h2>
            <p class="muted">{{ t('camera.cameraWhy') }}</p>
            <div class="actions">
              <button class="btn-ghost" type="button" (click)="close()">
                {{ t('camera.cancel') }}
              </button>
              <button class="btn-slate" type="button" (click)="startCamera()">
                {{ t('camera.allowCamera') }}
              </button>
            </div>
          }

          @case ('starting') {
            <h2>{{ t('camera.opening') }}</h2>
            <p class="muted">{{ t('camera.acceptBrowser') }}</p>
          }

          @case ('live') {
            <p class="step">{{ t('camera.step1') }}</p>
            <h2>{{ t('camera.frameIssue') }}</h2>
            <video #video class="viewfinder" autoplay playsinline muted></video>
            @if (error(); as message) {
              <p class="alert alert-error">{{ message }}</p>
            }
            <div class="actions">
              <button class="btn-ghost" type="button" (click)="close()">
                {{ t('camera.cancel') }}
              </button>
              <button class="btn-slate" type="button" (click)="shoot()">
                {{ t('camera.capture') }}
              </button>
            </div>
          }

          @case ('review') {
            <h2>{{ t('camera.usePhotoQ') }}</h2>
            <img class="viewfinder" [src]="previewUrl()" [alt]="t('alt.capturedPhoto')" />

            <!-- Checked on this device before anything is uploaded. A warning,
                 not a block: a broken-streetlight report is a photo of darkness,
                 and the citizen can see their own shot better than we can. -->
            @if (quality(); as q) {
              @if (q.warning) {
                <p class="alert" [class.alert-error]="!q.usable" [class.alert-ok]="q.usable">
                  {{ q.warning }}
                </p>
              }
            }

            <div class="actions">
              <button class="btn-ghost" type="button" (click)="retake()">
                {{ t('camera.retake') }}
              </button>
              <button class="btn-slate" type="button" (click)="askLocation()">
                {{ quality()?.warning ? t('camera.useAnyway') : t('camera.usePhoto') }}
              </button>
            </div>
          }

          @case ('location-consent') {
            <p class="step">{{ t('camera.step2') }}</p>
            <h2>{{ t('camera.pinSpot') }}</h2>
            <img class="thumb" [src]="previewUrl()" [alt]="t('alt.capturedPhoto')" />
            <p class="muted">{{ t('camera.locationWhy', { metres: required }) }}</p>
            <div class="actions">
              <button class="btn-ghost" type="button" (click)="close()">
                {{ t('camera.cancel') }}
              </button>
              <button class="btn-slate" type="button" (click)="requestLocation()">
                {{ t('camera.allowLocation') }}
              </button>
            </div>
          }

          @case ('locating') {
            <h2>{{ t('camera.pinpointing') }}</h2>
            @if (accuracy(); as metres) {
              <!-- Showing the number tightening turns an unexplained wait into
                   visible progress, and tells the citizen when to step outside. -->
              @if (metres <= required) {
                <!-- Past the bar, but GPS is usually still descending. Say so,
                     otherwise the extra seconds read as the app being stuck. -->
                <p class="accuracy">{{ t('camera.sharpening', { metres }) }}</p>
              } @else {
                <p class="accuracy">{{ t('camera.holdingOut', { metres, required }) }}</p>
              }
              <div class="meter" role="img" [attr.aria-label]="'Accurate to ' + metres + ' metres'">
                <span [style.width.%]="closeness()"></span>
              </div>
            } @else {
              <p class="muted">{{ t('camera.acceptPrompt') }}</p>
            }
            <p class="muted hint">{{ t('camera.skyHint') }}</p>
          }

          @case ('location-coarse') {
            <h2>{{ t('camera.closeNotExact') }}</h2>
            <p class="muted">{{ t('camera.coarseBody', { metres: accuracy() ?? 0 }) }}</p>
            <p class="muted hint">{{ t('camera.coarseHint', { exact }) }}</p>
            <div class="actions">
              <button class="btn-ghost" type="button" (click)="finish()">
                {{ t('camera.fileAnyway') }}
              </button>
              <button class="btn-slate" type="button" (click)="requestLocation()">
                {{ t('camera.tryExact') }}
              </button>
            </div>
          }

          @case ('location-failed') {
            <h2>{{ t('camera.notCloseEnough') }}</h2>
            <p class="alert alert-error">{{ error() }}</p>
            <p class="muted">{{ t('camera.failedBody', { metres: required }) }}</p>
            <div class="actions">
              <button class="btn-ghost" type="button" (click)="close()">
                {{ t('camera.cancelReport') }}
              </button>
              <button class="btn-slate" type="button" (click)="requestLocation()">
                {{ t('camera.tryAgain') }}
              </button>
            </div>
          }

          @case ('error') {
            <h2>{{ t('camera.unavailable') }}</h2>
            <p class="alert alert-error">{{ error() }}</p>
            <div class="actions">
              <button class="btn-ghost" type="button" (click)="close()">
                {{ t('common.close') }}
              </button>
              <button class="btn-slate" type="button" (click)="startCamera()">
                {{ t('camera.tryAgain') }}
              </button>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .accuracy {
      margin: 4px 0 8px;
      font-size: 0.95rem;
      color: var(--ink);
    }

    .accuracy b {
      font-variant-numeric: tabular-nums;
      color: var(--accent-strong);
    }

    .meter {
      height: 6px;
      border-radius: 999px;
      background: var(--surface-sunken);
      overflow: hidden;
      margin-bottom: 10px;
    }

    .meter span {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: var(--accent);
      transition: width 0.4s ease;
    }

    .hint {
      font-size: 0.84rem;
    }

    .scrim {
      position: fixed;
      inset: 0;
      z-index: 100;
      background: rgba(9, 17, 22, 0.6);
      backdrop-filter: blur(3px);
      display: grid;
      place-items: center;
      padding: 18px;
      animation: scrim-in 150ms ease;
    }

    @keyframes scrim-in {
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

    .step {
      font-size: 0.71rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      font-weight: 600;
      color: var(--accent-strong);
      margin: 0 0 6px;
    }

    h2 {
      font-size: 1.2rem;
      margin-bottom: 8px;
    }

    .muted {
      max-width: 52ch;
    }

    .viewfinder {
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      background: var(--surface-inverse);
      border-radius: var(--radius);
      border: 1px solid var(--line);
      margin: 14px 0 10px;
      display: block;
    }

    .thumb {
      width: 116px;
      height: 86px;
      object-fit: cover;
      border-radius: var(--radius);
      border: 1px solid var(--line);
      margin: 12px 0;
      display: block;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 18px;
    }
  `,
})
export class CameraCapture implements OnDestroy {
  protected readonly i18n = inject(I18nService);
  /** Bound so templates read `t('key')`; repaints when the language changes. */
  protected readonly t = this.i18n.t.bind(this.i18n);

  readonly captured = output<File>();
  readonly located = output<CapturedLocation>();
  readonly dismissed = output<void>();

  protected readonly stage = signal<Stage>('camera-consent');
  protected readonly error = signal<string | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  /** Live accuracy in metres while the fix converges. */
  protected readonly accuracy = signal<number | null>(null);
  /** The ceiling: past this a report cannot be filed at all. */
  protected readonly required = REQUIRED_ACCURACY_M;
  /** The goal: at or under this the fix is a pin rather than a block. */
  protected readonly exact = EXACT_ACCURACY_M;

  /** 0-100: how close the current fix is to being good enough. */
  protected readonly closeness = computed(() => {
    const metres = this.accuracy();
    if (metres === null) return 0;
    return Math.max(4, Math.min(100, Math.round((REQUIRED_ACCURACY_M / metres) * 100)));
  });
  /** Pre-upload quality verdict, computed on this device after capture. */
  protected readonly quality = signal<ImageVerdict | null>(null);

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');

  private readonly stream = signal<MediaStream | null>(null);
  private blob: Blob | null = null;
  private fix: CapturedLocation | null = null;

  constructor() {
    /**
     * Attaches the stream once the <video> actually exists.
     *
     * getUserMedia resolves before Angular has rendered the 'live' branch, so
     * reaching for the element straight after it returns finds nothing and the
     * preview stays black. viewChild() is a signal, so this re-runs the moment
     * the element appears.
     */
    effect(() => {
      const element = this.video()?.nativeElement;
      const stream = this.stream();
      if (!element || !stream || element.srcObject === stream) return;

      element.srcObject = stream;
      void element.play().catch(() => undefined);
    });
  }

  // ------------------------------------------------------------ step 1: photo

  async startCamera(): Promise<void> {
    this.error.set(null);
    this.stage.set('starting');

    try {
      this.stream.set(
        await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        }),
      );
    } catch (error) {
      this.stage.set('error');
      this.error.set(this.explainCamera(error));
      return;
    }

    // The effect in the constructor attaches the stream once this renders.
    this.stage.set('live');
  }

  shoot(): void {
    const element = this.video()?.nativeElement;
    if (!element) return;

    // Before the first frame arrives these are 0, and capturing would write a
    // blank JPEG rather than fail visibly.
    if (!element.videoWidth || !element.videoHeight) {
      this.error.set('The camera is still warming up — try again in a moment.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext('2d')?.drawImage(element, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        this.blob = blob;
        this.revokePreview();
        this.previewUrl.set(URL.createObjectURL(blob));
        this.stopStream();
        this.quality.set(null);
        this.stage.set('review');

        // Runs on this device, on a 128px downsample — a few milliseconds, no
        // network, and it happens while the citizen is already looking at the
        // shot. A failure here must never stand between them and filing.
        void inspectImage(blob)
          .then((verdict) => this.quality.set(verdict))
          .catch(() => this.quality.set(null));
      },
      'image/jpeg',
      0.85,
    );
  }

  retake(): void {
    this.blob = null;
    this.quality.set(null);
    this.revokePreview();
    void this.startCamera();
  }

  // --------------------------------------------------------- step 2: location

  /** Reached only once a photo exists, so the fix belongs to that photo. */
  askLocation(): void {
    this.error.set(null);
    this.stage.set('location-consent');
  }

  async requestLocation(): Promise<void> {
    this.stage.set('locating');
    this.accuracy.set(null);

    try {
      // Holds out for a fix a crew could walk to, but settles for the best the
      // device can manage rather than turning a real report away.
      this.fix = await watchBestFix((partial) => this.accuracy.set(Math.round(partial.accuracy)));
      this.accuracy.set(Math.round(this.fix.accuracy));

      // A rough fix is worth filing, but not worth filing silently — the
      // citizen is the one person who can still walk ten steps and fix it.
      if (!this.fix.precise) {
        this.stage.set('location-coarse');
        return;
      }

      this.finish();
    } catch (error) {
      this.error.set(explainGeolocationError(error));
      this.stage.set('location-failed');
    }
  }

  /**
   * Hands the photo — and the fix, if there is one — to the page. The location
   * goes first because emitting the file is what closes this dialog.
   */
  finish(): void {
    if (!this.blob) {
      this.close();
      return;
    }

    // Nothing reaches the page without coordinates. A coarse fix is allowed
    // through — flagged as such — but no fix at all is not.
    if (!this.fix) {
      this.error.set('No coordinates were captured for this photo.');
      this.stage.set('location-failed');
      return;
    }

    this.located.emit(this.fix);

    const file = new File([this.blob], `civicpulse-${Date.now()}.jpg`, { type: 'image/jpeg' });
    this.captured.emit(file);
    this.teardown();
  }

  close(): void {
    this.teardown();
    this.dismissed.emit();
  }

  ngOnDestroy(): void {
    this.teardown();
  }

  private explainCamera(error: unknown): string {
    const name = (error as DOMException)?.name ?? '';

    if (name === 'NotAllowedError') {
      return "Camera permission was denied. Allow it in your browser's site settings, then try again.";
    }
    if (name === 'NotFoundError') return 'No camera was found on this device.';
    if (name === 'NotReadableError') {
      return 'Another app is already using the camera. Close it and try again.';
    }
    if (!window.isSecureContext) {
      return 'Browsers only allow camera access over HTTPS or on localhost.';
    }
    return error instanceof Error ? error.message : 'Could not start the camera.';
  }

  private stopStream(): void {
    this.stream()?.getTracks().forEach((track) => track.stop());
    this.stream.set(null);
  }

  private revokePreview(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
  }

  private teardown(): void {
    this.stopStream();
    this.revokePreview();
  }
}
