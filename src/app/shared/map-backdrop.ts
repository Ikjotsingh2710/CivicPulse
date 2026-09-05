import { AfterViewInit, Component, ElementRef, OnDestroy, input, viewChild } from '@angular/core';

const SVG_NS = 'http://www.w3.org/2000/svg';

const W = 1200;
const H = 760;

/** Sampled from the reference: dark navy-teal ground, near-black water,
    desaturated green vegetation, pale lavender roads. */
const PALETTE = {
  land: '#16242c',
  landAlt: '#1a2f38',
  green: '#17403a',
  greenDeep: '#123430',
  water: '#070f13',
  road: '#aab4cc',
  roadMinor: '#5f6d84',
  routeGreen: '#3ddc84',
  routeAmber: '#f0a13a',
};

type Point = [number, number];

/** mulberry32 — small, fast, and repeatable for a given seed. */
function makeRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Catmull-Rom through the points, emitted as cubic beziers. This is what makes
 * the roads curve like surveyed roads rather than like polylines.
 */
function spline(points: readonly Point[], closed: boolean): string {
  const n = points.length;
  if (n < 2) return '';

  const at = (i: number): Point =>
    closed ? points[((i % n) + n) % n] : points[Math.max(0, Math.min(n - 1, i))];

  const parts = [`M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`];
  const segments = closed ? n : n - 1;

  for (let i = 0; i < segments; i++) {
    const [p0x, p0y] = at(i - 1);
    const [p1x, p1y] = at(i);
    const [p2x, p2y] = at(i + 1);
    const [p3x, p3y] = at(i + 2);

    const c1x = p1x + (p2x - p0x) / 6;
    const c1y = p1y + (p2y - p0y) / 6;
    const c2x = p2x - (p3x - p1x) / 6;
    const c2y = p2y - (p3y - p1y) / 6;

    parts.push(
      `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ` +
        `${p2x.toFixed(1)} ${p2y.toFixed(1)}`,
    );
  }

  if (closed) parts.push('Z');
  return parts.join(' ');
}

/** An irregular closed shape: a circle whose radius wobbles as it goes round. */
function blob(cx: number, cy: number, radius: number, rand: () => number): string {
  const count = 8 + Math.floor(rand() * 5);
  const points: Point[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = radius * (0.55 + rand() * 0.75);
    points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r * 0.72]);
  }

  return spline(points, true);
}

/** A road: walks across the frame, nudging its heading at every step. */
function lane(rand: () => number, steps: number, stepLength: number): Point[] {
  const fromLeft = rand() > 0.35;

  let x = fromLeft ? -80 : W * rand();
  let y = fromLeft ? H * rand() : -60;
  let heading = fromLeft ? (rand() - 0.5) * 0.9 : Math.PI / 2 + (rand() - 0.5) * 0.9;

  const points: Point[] = [[x, y]];

  for (let i = 0; i < steps; i++) {
    heading += (rand() - 0.5) * 0.52;
    x += Math.cos(heading) * stepLength;
    y += Math.sin(heading) * stepLength;
    points.push([x, y]);
  }

  return points;
}

/**
 * Where two road polylines cross. The drawn roads are splines through these
 * same points, so a segment crossing sits a hair off the rendered curve — close
 * enough that a blip reads as being on the junction.
 */
function crossing(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const d = (a2[0] - a1[0]) * (b2[1] - b1[1]) - (a2[1] - a1[1]) * (b2[0] - b1[0]);
  if (Math.abs(d) < 1e-6) return null;

  const t = ((b1[0] - a1[0]) * (b2[1] - b1[1]) - (b1[1] - a1[1]) * (b2[0] - b1[0])) / d;
  const u = ((b1[0] - a1[0]) * (a2[1] - a1[1]) - (b1[1] - a1[1]) * (a2[0] - a1[0])) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;

  return [a1[0] + t * (a2[0] - a1[0]), a1[1] + t * (a2[1] - a1[1])];
}

/** Every crossing between a set of roads, thinned so blips do not pile up. */
function junctions(roads: readonly Point[][], minGap = 46): Point[] {
  const found: Point[] = [];

  for (let i = 0; i < roads.length; i++) {
    for (let j = i + 1; j < roads.length; j++) {
      for (let a = 0; a < roads[i].length - 1; a++) {
        for (let b = 0; b < roads[j].length - 1; b++) {
          const point = crossing(roads[i][a], roads[i][a + 1], roads[j][b], roads[j][b + 1]);
          if (!point) continue;

          // Off-canvas crossings would animate where nobody can see them.
          const [x, y] = point;
          if (x < 30 || x > W - 30 || y < 30 || y > H - 30) continue;

          const tooClose = found.some(
            ([fx, fy]) => Math.hypot(fx - x, fy - y) < minGap,
          );
          if (!tooClose) found.push(point);
        }
      }
    }
  }

  return found;
}

/**
 * Generated map backdrop for the hero.
 *
 * Draws a label-free road network over organic land, water and vegetation
 * shapes. Nothing is fetched, so it renders identically offline and cannot
 * fail; a fresh seed on every load means a different city each visit.
 */
@Component({
  selector: 'cp-map-backdrop',
  standalone: true,
  template: `<div class="backdrop" #host aria-hidden="true"></div>`,
  styles: `
    :host {
      display: block;
      position: absolute;
      inset: 0;
      overflow: hidden;
      background: #16242c;
    }

    .backdrop,
    .backdrop svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
  `,
})
export class MapBackdrop implements AfterViewInit, OnDestroy {
  /** Fixed seed renders a repeatable map; omit it for a new one each load. */
  readonly seed = input<number>(Math.floor(Math.random() * 1_000_000_000));

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private observer: IntersectionObserver | null = null;

  ngAfterViewInit(): void {
    const host = this.host().nativeElement;
    host.appendChild(this.draw());
    this.watchVisibility(host);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  /**
   * Stops the blips animating once the hero is scrolled past.
   *
   * Nothing about a CSS animation stops when it leaves the viewport — the
   * browser keeps compositing every frame for a backdrop nobody can see, which
   * is pure battery and frame budget spent on nothing. The class this toggles
   * sets `animation-play-state: paused` in the global stylesheet.
   */
  private watchVisibility(host: HTMLElement): void {
    if (typeof IntersectionObserver === 'undefined') return;

    this.observer = new IntersectionObserver(
      ([entry]) => host.classList.toggle('cp-map-idle', !entry.isIntersecting),
      { threshold: 0 },
    );

    this.observer.observe(host);
  }

  private draw(): SVGSVGElement {
    const rand = makeRandom(this.seed());

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    // Fills the hero at any aspect ratio without distorting the geometry.
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');

    // A radial gradient that fades to transparent looks the same as a blurred
    // disc and costs nothing to animate. `filter: blur()` on a moving element
    // is re-rasterised every frame; a gradient fill is painted once and then
    // only scaled by the compositor. This is what makes the pulse smooth on a
    // phone rather than merely cheaper.
    const defs = document.createElementNS(SVG_NS, 'defs');
    for (const [id, colour] of [
      ['cp-glow-green', PALETTE.routeGreen],
      ['cp-glow-amber', PALETTE.routeAmber],
    ]) {
      const gradient = document.createElementNS(SVG_NS, 'radialGradient');
      gradient.setAttribute('id', id);

      for (const [offset, opacity] of [
        ['0%', '0.85'],
        ['45%', '0.35'],
        ['100%', '0'],
      ]) {
        const stop = document.createElementNS(SVG_NS, 'stop');
        stop.setAttribute('offset', offset);
        stop.setAttribute('stop-color', colour);
        stop.setAttribute('stop-opacity', opacity);
        gradient.appendChild(stop);
      }

      defs.appendChild(gradient);
    }
    svg.appendChild(defs);

    const add = (
      tag: string,
      attributes: Record<string, string | number>,
    ): SVGElement => {
      const element = document.createElementNS(SVG_NS, tag);
      for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, String(value));
      }
      svg.appendChild(element);
      return element;
    };

    add('rect', { x: 0, y: 0, width: W, height: H, fill: PALETTE.land });

    // Broad tonal variation so the ground is not a flat slab.
    for (let i = 0; i < 5; i++) {
      add('path', {
        d: blob(rand() * W, rand() * H, 190 + rand() * 220, rand),
        fill: PALETTE.landAlt,
        opacity: 0.55,
      });
    }

    // Vegetation.
    for (let i = 0; i < 9; i++) {
      add('path', {
        d: blob(rand() * W, rand() * H, 110 + rand() * 190, rand),
        fill: rand() > 0.5 ? PALETTE.green : PALETTE.greenDeep,
        opacity: 0.85,
      });
    }

    // Water and dense forest read as near-black cut-outs in the reference.
    for (let i = 0; i < 4; i++) {
      add('path', {
        d: blob(rand() * W, rand() * H, 70 + rand() * 130, rand),
        fill: PALETTE.water,
        opacity: 0.9,
      });
    }

    // Minor roads first, so the majors cross over them at junctions. Their
    // polylines are kept too — most crossings on the map are minor ones.
    const minors: Point[][] = [];

    for (let i = 0; i < 22; i++) {
      const points = lane(rand, 4 + Math.floor(rand() * 5), 70 + rand() * 70);
      minors.push(points);

      add('path', {
        d: spline(points, false),
        fill: 'none',
        stroke: PALETTE.roadMinor,
        'stroke-width': 1.1,
        'stroke-linecap': 'round',
        opacity: 0.5,
        ...(rand() > 0.7 ? { 'stroke-dasharray': '5 6' } : {}),
      });
    }

    // Majors are kept as polylines so their crossings can be found afterwards.
    const majors: Point[][] = [];

    for (let i = 0; i < 7; i++) {
      const points = lane(rand, 9 + Math.floor(rand() * 5), 100 + rand() * 60);
      majors.push(points);

      add('path', {
        d: spline(points, false),
        fill: 'none',
        stroke: PALETTE.road,
        'stroke-width': 2.1,
        'stroke-linecap': 'round',
        opacity: 0.62,
      });
    }

    // One highlighted route, echoing the green-with-amber-congestion trunk road.
    const routePoints = lane(rand, 13, 118);
    majors.push(routePoints);
    const route = spline(routePoints, false);

    add('path', {
      d: route,
      fill: 'none',
      stroke: PALETTE.routeGreen,
      'stroke-width': 4.2,
      'stroke-linecap': 'round',
      opacity: 0.9,
    });

    add('path', {
      d: route,
      fill: 'none',
      stroke: PALETTE.routeAmber,
      'stroke-width': 4.2,
      'stroke-linecap': 'butt',
      'stroke-dasharray': '46 150 26 190 60 120',
      opacity: 0.95,
    });

    // A live blip on junctions the network produces. Capped hard: each blip is
    // three animated nodes and at least one of them is blurred, so the browser
    // re-rasterises every one of them on every frame. Fifty-two of these made
    // the hero visibly stutter on a mid-range phone; the map reads as just as
    // alive at a third of that, because they pulse out of phase.
    const crossings = junctions([...majors, ...minors], 30).slice(0, 18);

    for (const [x, y] of crossings) {
      const onTrunk = x > W * 0.34;
      svg.appendChild(this.blip(x, y, PALETTE.routeGreen, rand() * 3.4, !onTrunk));
    }

    for (let i = 0; i < 3; i++) {
      svg.appendChild(
        this.blip(80 + rand() * (W - 160), 70 + rand() * (H - 140), PALETTE.routeAmber, rand() * 3),
      );
    }

    // The left third sits under the heaviest part of the scrim and the roads
    // rarely cross there, so it is seeded deliberately rather than left bare.
    for (let i = 0; i < 3; i++) {
      svg.appendChild(
        this.blip(
          52 + rand() * (W * 0.3 - 52),
          90 + (i / 3) * (H - 180) + rand() * 70,
          i % 2 === 0 ? PALETTE.routeGreen : PALETTE.routeAmber,
          rand() * 3,
          true,
        ),
      );
    }

    // Top right, seeded the same way: the lanes run mostly diagonally, so that
    // corner is often the emptiest part of the frame.
    for (let i = 0; i < 3; i++) {
      svg.appendChild(
        this.blip(
          W * 0.6 + (i / 3) * (W * 0.38) + rand() * 46,
          64 + rand() * (H * 0.38),
          i % 2 === 0 ? PALETTE.routeGreen : PALETTE.routeAmber,
          rand() * 3,
          true,
        ),
      );
    }

    return svg;
  }

  /**
   * One pulsing marker: a solid core with a ring expanding out of it.
   *
   * The animation classes live in the global stylesheet — these nodes are built
   * by hand, so they carry none of the attributes Angular's style encapsulation
   * relies on and component styles would never match them.
   */
  /**
   * `strong` widens the halo and the bloom. The left of the hero carries the
   * heaviest part of the scrim, so a blip at normal intensity is swallowed by
   * it — those get the brighter treatment to punch through.
   */
  private blip(
    x: number,
    y: number,
    colour: string,
    delaySeconds: number,
    strong = false,
  ): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g') as SVGGElement;
    const delay = `animation-delay: ${delaySeconds.toFixed(2)}s`;

    const circle = (r: number, className: string, style: string): SVGCircleElement => {
      const element = document.createElementNS(SVG_NS, 'circle');
      element.setAttribute('cx', x.toFixed(1));
      element.setAttribute('cy', y.toFixed(1));
      element.setAttribute('r', String(r));
      element.setAttribute('class', className);
      element.setAttribute('style', style);
      return element;
    };

    // A soft pool of colour under the marker, painted as a gradient rather than
    // a blurred disc so that animating it costs the compositor nothing.
    const halo = circle(
      strong ? 26 : 19,
      strong ? 'cp-blip-halo cp-blip-halo-strong' : 'cp-blip-halo',
      delay,
    );
    halo.setAttribute(
      'fill',
      colour === PALETTE.routeAmber ? 'url(#cp-glow-amber)' : 'url(#cp-glow-green)',
    );

    // No drop-shadow here. A filter on an element that is also animating forces
    // the browser to re-blur it every frame; the halo behind already supplies
    // the glow, so this one only has to be a crisp ring.
    const ring = circle(strong ? 6.4 : 5.4, 'cp-blip-ring', delay);
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', colour);
    ring.setAttribute('stroke-width', strong ? '1.9' : '1.6');

    // No filter at all now. The gradient halo behind supplies every bit of the
    // bloom this used to draw, and nothing on a moving element gets re-blurred.
    const core = circle(strong ? 4.2 : 3.4, 'cp-blip-core', delay);
    core.setAttribute('fill', colour);

    group.appendChild(halo);
    group.appendChild(ring);
    group.appendChild(core);
    return group;
  }
}
