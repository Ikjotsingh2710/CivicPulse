import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
// maplibre-gl v6 ships named exports only — there is no default export.
import { Map as MapLibreMap, Marker } from 'maplibre-gl';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

/**
 * The OpenFreeMap styles declare their vector source as `openmaptiles`, not
 * `openfreemap` — addLayer throws "source not found" if you guess wrong.
 */
const VECTOR_SOURCE = 'openmaptiles';

/**
 * Interactive dark 3D basemap, used as the homepage backdrop.
 *
 * Deliberately does NOT ask for geolocation itself: the app asks once, in its
 * own consent dialog, before the camera opens. This component just renders
 * whatever coordinate it is handed.
 */
@Component({
  selector: 'cp-map-canvas',
  standalone: true,
  template: `
    <div class="map-root" #host></div>
    @if (failed()) {
      <p class="map-note">Live map unavailable — showing a static view.</p>
    }
  `,
  styles: `
    :host {
      display: block;
      position: absolute;
      inset: 0;
    }

    .map-root {
      position: absolute;
      inset: 0;
    }

    /* The basemap is scenery: it must not swallow clicks aimed at the hero. */
    :host ::ng-deep .maplibregl-canvas-container,
    :host ::ng-deep .maplibregl-canvas {
      outline: none;
    }

    :host ::ng-deep .maplibregl-ctrl-attrib {
      background: rgba(2, 24, 15, 0.62);
      border-radius: 6px 0 0 0;
      font-size: 10px;
    }

    :host ::ng-deep .maplibregl-ctrl-attrib a {
      color: rgba(243, 239, 230, 0.66);
    }

    .map-note {
      position: absolute;
      right: 10px;
      bottom: 8px;
      margin: 0;
      font-size: 0.72rem;
      color: rgba(243, 239, 230, 0.4);
    }
  `,
})
export class MapCanvas implements AfterViewInit, OnDestroy {
  readonly lat = input.required<number>();
  readonly lng = input.required<number>();
  /** Drops the pulsing pointer only once there is a real GPS fix. */
  readonly showPointer = input(false);
  readonly interactive = input(true);

  protected readonly failed = signal(false);

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  private map: MapLibreMap | null = null;
  private marker: Marker | null = null;
  private spinFrame = 0;
  private userTouched = false;

  constructor() {
    // Recentre whenever the campus selection or the GPS fix changes.
    effect(() => {
      const target: [number, number] = [this.lng(), this.lat()];
      const pointer = this.showPointer();

      if (!this.map) return;

      this.map.flyTo({ center: target, zoom: pointer ? 16.5 : 15.2, duration: 2200, essential: true });
      this.placeMarker(target, pointer);
    });
  }

  ngAfterViewInit(): void {
    // WebGL is required; a soft failure keeps the CSS backdrop visible.
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: this.host().nativeElement,
        style: STYLE_URL,
        center: [this.lng(), this.lat()],
        zoom: 15.2,
        pitch: 60,
        bearing: -20,
        attributionControl: { compact: true },
        interactive: this.interactive(),
        // Page scroll must keep working over a full-bleed hero map.
        scrollZoom: false,
        doubleClickZoom: false,
        keyboard: false,
      });
    } catch {
      this.failed.set(true);
      return;
    }

    this.map = map;

    map.on('error', () => this.failed.set(true));

    map.on('load', () => {
      this.addBuildings();
      this.placeMarker([this.lng(), this.lat()], this.showPointer());
      this.startSpin();
    });

    // Any deliberate interaction ends the idle camera drift for good.
    for (const event of ['dragstart', 'mousedown', 'touchstart'] as const) {
      map.on(event, () => this.stopSpin());
    }
  }

  ngOnDestroy(): void {
    this.stopSpin();
    this.marker?.remove();
    this.map?.remove();
    this.map = null;
  }

  /** Extrudes the vector building footprints the flat dark style ships with. */
  private addBuildings(): void {
    if (!this.map || this.map.getLayer('cp-3d-buildings')) return;

    // Slip the extrusion under the first symbol layer so place labels and
    // street names stay legible on top of the skyline.
    const labelLayer = this.map
      .getStyle()
      .layers?.find((layer) => layer.type === 'symbol')?.id;

    try {
      this.map.addLayer(
        {
          id: 'cp-3d-buildings',
          source: VECTOR_SOURCE,
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 13,
          // The tiles flag parts that should not be extruded on their own.
          filter: ['!=', ['get', 'hide_3d'], true],
          paint: {
            // Taller buildings read lighter, which gives the skyline depth.
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['coalesce', ['get', 'render_height'], 8],
              0,
              '#0a2b1f',
              60,
              '#10553a',
              180,
              '#1a7a52',
            ],
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.9,
          },
        },
        labelLayer,
      );
    } catch {
      // A style without a building layer is not worth failing the page over.
    }
  }

  private placeMarker(center: [number, number], visible: boolean): void {
    if (!this.map) return;

    this.marker?.remove();
    this.marker = null;
    if (!visible) return;

    const element = document.createElement('div');
    element.className = 'cp-map-pointer';
    element.innerHTML = '<span class="cp-map-ping"></span>';

    this.marker = new Marker({ element }).setLngLat(center).addTo(this.map);
  }

  /** Slow orbit so the hero has life before anyone touches it. */
  private startSpin(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const step = () => {
      if (!this.map || this.userTouched) return;
      this.map.setBearing(this.map.getBearing() + 0.012);
      this.spinFrame = requestAnimationFrame(step);
    };

    this.spinFrame = requestAnimationFrame(step);
  }

  private stopSpin(): void {
    this.userTouched = true;
    if (this.spinFrame) cancelAnimationFrame(this.spinFrame);
    this.spinFrame = 0;
  }
}
