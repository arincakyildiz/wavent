import { Component, computed, input } from '@angular/core';

export interface BarDatum {
  label: string;
  value: number;
}

interface RenderedBar extends BarDatum {
  x: number;
  y: number;
  height: number;
  labelY: number;
}

const WIDTH = 420;
const HEIGHT = 200;
const PAD_LEFT = 34;
const PAD_TOP = 16;
const PAD_BOTTOM = 12;
const BAR_WIDTH = 26;

/** Vertical bar chart with a horizontal grid and value labels above each bar. */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + width + ' ' + height"
      preserveAspectRatio="xMidYMid meet"
      class="chart"
      role="img"
      [attr.aria-label]="axisLabel()"
    >
      @for (t of ticks(); track t.value) {
        <line [attr.x1]="padLeft" [attr.y1]="t.y" [attr.x2]="width" [attr.y2]="t.y" stroke="var(--grid-line)" stroke-width="1" />
        <text [attr.x]="padLeft - 8" [attr.y]="t.y + 3.5" text-anchor="end" class="chart__tick">{{ t.value }}</text>
      }

      @for (bar of bars(); track bar.label) {
        <rect
          [attr.x]="bar.x"
          [attr.y]="bar.y"
          [attr.width]="barWidth"
          [attr.height]="bar.height"
          rx="4"
          fill="var(--accent)"
        />
        <text [attr.x]="bar.x + barWidth / 2" [attr.y]="bar.labelY" text-anchor="middle" class="chart__value">
          {{ bar.value }}
        </text>
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
    }

    .chart {
      width: 100%;
      height: auto;
      overflow: visible;
    }

    .chart__tick {
      fill: var(--text-muted);
      font-size: 10px;
    }

    .chart__value {
      fill: var(--text-secondary);
      font-size: 10.5px;
      font-weight: 600;
    }
  `,
})
export class BarChartComponent {
  readonly data = input.required<BarDatum[]>();
  readonly max = input(200);
  readonly tickStep = input(50);
  readonly axisLabel = input('Value');

  readonly width = WIDTH;
  readonly height = HEIGHT;
  readonly padLeft = PAD_LEFT;
  readonly barWidth = BAR_WIDTH;

  private readonly plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  readonly ticks = computed(() => {
    const out: { value: number; y: number }[] = [];
    for (let v = 0; v <= this.max(); v += this.tickStep()) {
      out.push({ value: v, y: PAD_TOP + this.plotHeight - (v / this.max()) * this.plotHeight });
    }
    return out;
  });

  readonly bars = computed<RenderedBar[]>(() => {
    const items = this.data();
    if (!items.length) return [];

    const plotWidth = WIDTH - PAD_LEFT;
    const slot = plotWidth / items.length;

    return items.map((d, i) => {
      const h = Math.max(2, (d.value / this.max()) * this.plotHeight);
      const y = PAD_TOP + this.plotHeight - h;
      return {
        ...d,
        x: PAD_LEFT + slot * i + (slot - BAR_WIDTH) / 2,
        y,
        height: h,
        labelY: y - 6,
      };
    });
  });
}
