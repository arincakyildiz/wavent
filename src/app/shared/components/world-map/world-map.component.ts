import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

export interface MapMarker {
  city: string;
  lon: number;
  lat: number;
  value: number;
  /** Where the text block sits relative to the dot. */
  anchor?: 'start' | 'end' | 'middle';
  /** Vertical nudge so neighbouring labels don't collide. */
  above?: boolean;
}

interface Dot {
  x: number;
  y: number;
}

interface RenderedMarker extends MapMarker {
  x: number;
  y: number;
  textX: number;
  cityY: number;
  valueY: number;
  textAnchor: string;
}

/**
 * Coarse landmass outlines in [lon, lat] pairs. Precision only needs to be good
 * enough that the stippled grid reads as a world map at dashboard scale.
 */
const LANDMASSES: number[][] = [
  // North America
  [
    -168, 65, -160, 71, -140, 70, -125, 70, -110, 68, -95, 72, -85, 70, -78, 62, -64, 60, -55, 52,
    -60, 45, -70, 42, -75, 35, -81, 25, -97, 26, -98, 18, -105, 20, -115, 30, -125, 40, -125, 48,
    -135, 58, -150, 60,
  ],
  // Central America
  [-98, 18, -92, 15, -83, 9, -77, 8, -84, 15, -92, 17],
  // Greenland
  [-45, 60, -20, 70, -20, 82, -50, 83, -58, 70],
  // South America
  [
    -81, 8, -75, 10, -60, 10, -52, 5, -35, -5, -38, -15, -48, -25, -58, -35, -62, -42, -66, -50, -72,
    -52, -73, -45, -71, -30, -70, -18, -78, -5,
  ],
  // Europe
  [-10, 36, 0, 44, 3, 50, -5, 58, 5, 62, 15, 68, 30, 70, 40, 68, 40, 55, 35, 45, 28, 41, 20, 40, 15, 37, 10, 38, 0, 36],
  // British Isles
  [-8, 51, -2, 51, 0, 56, -3, 59, -8, 56],
  // Africa
  [
    -17, 15, -17, 25, -10, 30, 0, 35, 10, 37, 20, 32, 32, 31, 35, 25, 38, 18, 43, 12, 51, 12, 43, 0,
    40, -10, 35, -20, 32, -27, 25, -34, 18, -34, 12, -18, 9, -1, 5, 5, -8, 5,
  ],
  // Madagascar
  [43, -12, 50, -15, 50, -25, 45, -25],
  // Asia
  [
    40, 68, 60, 72, 80, 75, 100, 78, 120, 74, 140, 72, 160, 70, 180, 66, 170, 60, 155, 58, 140, 50,
    130, 42, 122, 38, 120, 30, 110, 20, 105, 10, 100, 5, 95, 15, 88, 22, 80, 15, 72, 8, 68, 22, 60,
    25, 55, 25, 48, 30, 45, 38, 40, 42, 40, 55,
  ],
  // Japan
  [130, 32, 142, 40, 146, 45, 140, 36, 133, 33],
  // Indonesia / SE Asia islands
  [95, 5, 120, 0, 140, -5, 130, -8, 110, -8, 95, 5],
  // Philippines
  [119, 6, 126, 8, 126, 18, 120, 16],
  // Australia
  [114, -22, 122, -18, 130, -12, 142, -11, 150, -22, 153, -28, 150, -38, 140, -38, 130, -32, 118, -34],
  // New Zealand
  [172, -35, 178, -38, 174, -46, 168, -44],
];

const LON_MIN = -170;
const LON_MAX = 180;
const LAT_MAX = 80;
const LAT_MIN = -56;
const STEP = 3.6;

const VIEW_W = 620;
const VIEW_H = 300;

function project(lon: number, lat: number): Dot {
  return {
    x: ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * VIEW_W,
    y: ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * VIEW_H,
  };
}

function isInside(lon: number, lat: number, poly: number[]): boolean {
  let inside = false;
  const n = poly.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i * 2];
    const yi = poly[i * 2 + 1];
    const xj = poly[j * 2];
    const yj = poly[j * 2 + 1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function buildDots(): Dot[] {
  const dots: Dot[] = [];
  for (let lat = LAT_MAX; lat >= LAT_MIN; lat -= STEP) {
    for (let lon = LON_MIN; lon <= LON_MAX; lon += STEP) {
      if (LANDMASSES.some((poly) => isInside(lon, lat, poly))) {
        dots.push(project(lon, lat));
      }
    }
  }
  return dots;
}

/** Computed once per bundle, not per component instance. */
const DOTS = buildDots();

@Component({
  selector: 'app-world-map',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <svg [attr.viewBox]="'0 0 ' + viewW + ' ' + viewH" class="map" role="img" aria-label="Inventory distribution by warehouse">
      <g fill="var(--map-dot)">
        @for (d of dots; track $index) {
          <circle [attr.cx]="d.x.toFixed(1)" [attr.cy]="d.y.toFixed(1)" r="1.35" />
        }
      </g>

      @for (m of markers(); track m.city) {
        <g>
          <circle [attr.cx]="m.x" [attr.cy]="m.y" r="9" fill="var(--accent)" opacity="0.18" />
          <circle [attr.cx]="m.x" [attr.cy]="m.y" r="4" fill="var(--warning)" stroke="var(--surface-1)" stroke-width="1.5" />
          <text [attr.x]="m.textX" [attr.y]="m.cityY" [attr.text-anchor]="m.textAnchor" class="map__city">{{ m.city }}</text>
          <text [attr.x]="m.textX" [attr.y]="m.valueY" [attr.text-anchor]="m.textAnchor" class="map__value">
            {{ m.value | number }}
          </text>
        </g>
      }
    </svg>

    <div class="legend">
      <span class="legend__label">Low</span>
      <span class="legend__scale"></span>
      <span class="legend__label">High</span>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .map {
      width: 100%;
      height: auto;
      display: block;
      overflow: visible;
    }

    .map__city {
      fill: var(--text-primary);
      font-size: 11px;
      font-weight: 600;
    }

    .map__value {
      fill: var(--text-muted);
      font-size: 10.5px;
    }

    .legend {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 10px;
      font-size: 11px;
      color: var(--text-muted);
    }

    .legend__scale {
      flex: 1;
      height: 5px;
      border-radius: 999px;
      background: linear-gradient(90deg, #1e3a8a, #2563eb, #22c55e, #eab308);
    }
  `,
})
export class WorldMapComponent {
  readonly points = input.required<MapMarker[]>();

  readonly viewW = VIEW_W;
  readonly viewH = VIEW_H;
  readonly dots = DOTS;

  readonly markers = computed<RenderedMarker[]>(() =>
    this.points().map((m) => {
      const { x, y } = project(m.lon, m.lat);
      const anchor = m.anchor ?? 'middle';
      const dx = anchor === 'start' ? 12 : anchor === 'end' ? -12 : 0;
      const baseY = m.above ? y - 26 : y + 18;
      return {
        ...m,
        x,
        y,
        textX: x + dx,
        cityY: baseY,
        valueY: baseY + 13,
        textAnchor: anchor,
      };
    }),
  );
}
