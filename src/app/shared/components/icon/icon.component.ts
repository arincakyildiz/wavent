import { Component, computed, input } from '@angular/core';

/**
 * Inline SVG icon set. No external assets or fonts — every glyph is described
 * as plain path/circle/rect geometry on a 24x24 grid so it inherits currentColor.
 */
interface IconDef {
  paths?: string[];
  circles?: [number, number, number][];
  rects?: [number, number, number, number, number?][];
  lines?: [number, number, number, number][];
}

const ICONS: Record<string, IconDef> = {
  menu: { paths: ['M4 6h16', 'M4 12h16', 'M4 18h16'] },
  dashboard: {
    rects: [
      [3, 3, 7, 9, 1.5],
      [14, 3, 7, 5, 1.5],
      [14, 12, 7, 9, 1.5],
      [3, 16, 7, 5, 1.5],
    ],
  },
  warehouse: { paths: ['M2 21V8l10-5 10 5v13', 'M6 21v-8h12v8', 'M9 21v-4h6v4'] },
  boxes: {
    paths: ['M3 8.5 8 6l5 2.5V14l-5 2.5L3 14z', 'M13 11.5 18 9l3 1.5V16l-3 1.5-5-2.5z', 'M8 6V3.5L13 1l5 2.5V9'],
  },
  barcode: { paths: ['M3 5v14', 'M7 5v14', 'M11 5v10', 'M15 5v14', 'M19 5v14'] },
  transfer: { paths: ['m16 3 4 4-4 4', 'M20 7H5', 'm8 21-4-4 4-4', 'M4 17h15'] },
  bookmark: { paths: ['m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'] },
  inbox: {
    paths: [
      'M22 12h-6l-2 3h-4l-2-3H2',
      'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
    ],
  },
  putaway: { paths: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'] },
  waves: {
    paths: [
      'M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 1.3 0 1.9-.5 2.5-1',
      'M2 12c.6.5 1.2 1 2.5 1C7 13 7 11 9.5 11c2.6 0 2.4 2 5 2 1.3 0 1.9-.5 2.5-1',
      'M2 18c.6.5 1.2 1 2.5 1C7 19 7 17 9.5 17c2.6 0 2.4 2 5 2 1.3 0 1.9-.5 2.5-1',
    ],
  },
  target: { circles: [[12, 12, 9], [12, 12, 5], [12, 12, 1.5]] },
  package: {
    paths: [
      'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
      'm3.3 7 8.7 5 8.7-5',
      'M12 22V12',
    ],
  },
  truck: {
    paths: [
      'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2',
      'M15 18H9',
      'M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14',
    ],
    circles: [[17, 18, 2], [7, 18, 2]],
  },
  clipboardCheck: {
    paths: [
      'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2',
      'm9 14 2 2 4-4',
    ],
    rects: [[8, 2, 8, 4, 1]],
  },
  alertTriangle: {
    paths: ['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z', 'M12 9v4', 'M12 17h.01'],
  },
  gitBranch: {
    paths: ['M18 9a9 9 0 0 1-9 9'],
    lines: [[6, 3, 6, 15]],
    circles: [[18, 6, 3], [6, 18, 3]],
  },
  radio: {
    paths: [
      'M4.9 19.1C1 15.2 1 8.8 4.9 4.9',
      'M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5',
      'M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5',
      'M19.1 4.9C23 8.8 23 15.1 19.1 19',
    ],
    circles: [[12, 12, 2]],
  },
  fileText: {
    paths: ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v5h5', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  },
  settings: {
    paths: [
      'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
    ],
    circles: [[12, 12, 3]],
  },
  moon: { paths: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'] },
  sun: {
    circles: [[12, 12, 4]],
    paths: ['M12 2v2', 'M12 20v2', 'm4.93 4.93 1.41 1.41', 'm17.66 17.66 1.41 1.41', 'M2 12h2', 'M20 12h2', 'm6.34 17.66-1.41 1.41', 'm19.07 4.93-1.41 1.41'],
  },
  chevronLeft: { paths: ['m15 18-6-6 6-6'] },
  chevronRight: { paths: ['m9 18 6-6-6-6'] },
  chevronDown: { paths: ['m6 9 6 6 6-6'] },
  search: { circles: [[11, 11, 8]], paths: ['m21 21-4.3-4.3'] },
  bell: {
    paths: [
      'M10.27 21a2 2 0 0 0 3.46 0',
      'M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33',
    ],
  },
  message: { paths: ['M22 17a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z'] },
  globe: { circles: [[12, 12, 10]], paths: ['M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20', 'M2 12h20'] },
  plus: { paths: ['M5 12h14', 'M12 5v14'] },
  refresh: {
    paths: ['M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8', 'M21 3v5h-5', 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16', 'M8 16H3v5'],
  },
  calendar: {
    rects: [[3, 4, 18, 18, 2]],
    paths: ['M8 2v4', 'M16 2v4', 'M3 10h18'],
  },
  arrowRight: { paths: ['M5 12h14', 'm12 5 7 7-7 7'] },
  checkCircle: { paths: ['M21.8 10A10 10 0 1 1 17 3.34', 'm9 11 3 3L22 4'] },
  scanLine: {
    paths: ['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2', 'M7 12h10'],
  },
  layers: { paths: ['m12 2 9 5-9 5-9-5 9-5Z', 'm3 12 9 5 9-5', 'm3 17 9 5 9-5'] },
  clock: { circles: [[12, 12, 10]], paths: ['M12 6v6l4 2'] },
  x: { paths: ['M18 6 6 18', 'm6 6 12 12'] },
};

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @for (d of def().paths ?? []; track $index) {
        <path [attr.d]="d" />
      }
      @for (c of def().circles ?? []; track $index) {
        <circle [attr.cx]="c[0]" [attr.cy]="c[1]" [attr.r]="c[2]" />
      }
      @for (r of def().rects ?? []; track $index) {
        <rect [attr.x]="r[0]" [attr.y]="r[1]" [attr.width]="r[2]" [attr.height]="r[3]" [attr.rx]="r[4] ?? 2" />
      }
      @for (l of def().lines ?? []; track $index) {
        <line [attr.x1]="l[0]" [attr.y1]="l[1]" [attr.x2]="l[2]" [attr.y2]="l[3]" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
  `,
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(18);
  readonly strokeWidth = input(1.8);

  readonly def = computed<IconDef>(() => ICONS[this.name()] ?? {});
}
