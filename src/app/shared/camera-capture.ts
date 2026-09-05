import {
  Component,
  ElementRef,
  OnDestroy,
  effect,
  output,
  signal,
  viewChild,
} from '@angular/core';

export interface CapturedLocation {
  latitude: number;
  longitude: number;
}

type Stage =
  | 'camera-consent'
  | 'starting'
  | 'live'
  | 'review'
  | 'location-consent'
  | 'locating'
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
    <div class="scrim" role="dialog" aria-modal="true" aria-label="Capture live photo">
      <div class="sheet">
        @switch (stage()) {
          @case ('camera-consent') {
            <p class="step">Step 1 of 2</p>
            <h2>Use your camera</h2>
            <p class="muted">
              The photo has to be taken here, at the scene — gallery uploads aren't accepted,
              because a ward desk can't act on a picture that might be from anywhere.
            </p>
            <div class="actions">
              <button class="btn-ghost" type="button" (click)="close()">Cancel</button>
              <button class="btn-slate" type="button" (click)="startCamera()">
                Allow camera
              </button>
            </div>
          }

          @case ('starting') {
            <h2>Opening camera…</h2>
            <p class="muted">Accept your browser's permission prompt to continue.</p>
          }

          @case ('live') {
            <p class="step">Step 1 of 2</p>
            <h2>Frame the issue</h2>
            <video #video class="viewfinder" autoplay playsinline muted></video>
            @if (error(); as message) {
              <p class="alert alert-error">{{ message }}</p>
            }
            <div class="actions">
              <button class="btn-ghost" type="button" (click)="close()">Cancel</button>
              <button class="btn-slate" type="button" (click)="shoot()">Capture</button>
            </div>
          }

          @case ('review') {
            <h2>Use this photo?</h2>
            <img class="viewfinder" [src]="previewUrl()" alt="Captured photo" />
            <div class="actions">
              <button class="btn-ghost" type="button" (click)="retake()">Retake</button>
              <button class="btn-slate" type="button" (click)="askLocation()">Use photo</button>
            </div>
          }

          @case ('location-consent') {
            <p class="step">Step 2 of 2</p>
            <h2>Add the location</h2>
            <img class="thumb" [src]="previewUrl()" alt="Captured photo" />
            <p class="muted">
              A geotag is how crews find the exact spot. It is read from this device now, so it
              matches where the photo was taken.
            </p>
            <div class="actions">
              <button class="btn-ghost" type="button" (click)="finish()">Skip</button>
              <button class="btn-slate" type="button" (click)="requestLocation()">
                Allow location
              </button>
            </div>
          }

          @case ('locating') {
            <h2>Getting your location…</h2>
            <p class="muted">Accept your browser's permission prompt to continue.</p>
          }

          @case ('location-failed') {
            <h2>Location unavailable</h2>
            <p class="alert alert-error">{{ error() }}</p>
            <p class="muted">
              You can still file the report — the ward and your description will have to place it.
            </p>
            <div class="actions">
              <button class="btn-ghost" type="button" (click)="finish()">
                Continue without it
              </button>
              <button class="btn-slate" type="button" (click)="requestLocation()">Try again</button>
            </div>
          }

          @case ('error') {
            <h2>Camera unavailable</h2>
            <p class="alert alert-error">{{ error() }}</p>
            <div class="actions">
              <button class="btn-ghost" type="button" (click)="close()">Close</button>
              <button class="btn-slate" type="button" (click)="startCamera()">Try again</button>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: `
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
  readonly captured = output<File>();
  readonly located = output<CapturedLocation>();
  readonly dismissed = output<void>();

  protected readonly stage = signal<Stage>('camera-consent');
  protected readonly error = signal<string | null>(null);
  protected readonly previewUrl = signal<string | null>(null);

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
        this.stage.set('review');
      },
      'image/jpeg',
      0.85,
    );
  }

  retake(): void {
    this.blob = null;
    this.revokePreview();
    void this.startCamera();
  }

  // --------------------------------------------------------- step 2: location

  /** Reached only once a photo exists, so the fix belongs to that photo. */
  askLocation(): void {
    this.error.set(null);
    this.stage.set('location-consent');
  }

  requestLocation(): void {
    if (!navigator.geolocation) {
      this.error.set('This browser cannot share a location.');
      this.stage.set('location-failed');
      return;
    }

    this.stage.set('locating');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.fix = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        this.finish();
      },
      (error) => {
        this.error.set(this.explainLocation(error));
        this.stage.set('location-failed');
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
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

    if (this.fix) this.located.emit(this.fix);

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

  private explainLocation(error: GeolocationPositionError): string {
    if (error.code === error.PERMISSION_DENIED) {
      return "Location permission was denied. You can allow it in your browser's site settings.";
    }
    if (error.code === error.POSITION_UNAVAILABLE) {
      return 'Your device could not get a fix right now.';
    }
    if (error.code === error.TIMEOUT) return 'Getting a location fix took too long.';
    return error.message || 'Could not read your location.';
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
