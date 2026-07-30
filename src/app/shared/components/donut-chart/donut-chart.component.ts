import { Component, computed, input } from '@angular/core';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface RenderedSegment extends DonutSegment {
  dash: number;
  gap: number;
  offset: number;
  pct: number;
}

/** Geometry is expressed in viewBox units; `size` only scales the rendered box. */
const VIEW = 176;
const RADIUS = 68;
const STROKE = 22;

/** Ring chart with a value stacked in the middle. */
@Component({
  selector: 'app-donut-chart',
  standalone: true,
  template: `
    <div class="donut">
      <svg [attr.viewBox]="'0 0 ' + view + ' ' + view" [attr.width]="size()" [attr.height]="size()" role="img" [attr.aria-label]="centerLabel()">
        <g [attr.transform]="'rotate(-90 ' + view / 2 + ' ' + view / 2 + ')'">
          <circle
            [attr.cx]="view / 2"
            [attr.cy]="view / 2"
            [attr.r]="radius"
            fill="none"
            stroke="var(--surface-3)"
            [attr.stroke-width]="stroke"
          />
          @for (s of rendered(); track s.label) {
            <circle
              [attr.cx]="view / 2"
              [attr.cy]="view / 2"
              [attr.r]="radius"
              fill="none"
              [attr.stroke]="s.color"
              [attr.stroke-width]="stroke"
              [attr.stroke-dasharray]="s.dash + ' ' + s.gap"
              [attr.stroke-dashoffset]="s.offset"
              stroke-linecap="butt"
            />
          }
        </g>
      </svg>
      <div class="donut__center" [style.width.px]="size()">
        <div class="donut__value">{{ total() }}</div>
        <div class="donut__label">{{ centerLabel() }}</div>
      </div>
    </div>
  `,
  styles: `
    .donut {
      position: relative;
      display: grid;
      place-items: center;
      line-height: 0;
    }

    .donut__center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      line-height: 1.25;
      pointer-events: none;
    }

    .donut__value {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .donut__label {
      font-size: 11.5px;
      color: var(--text-muted);
    }
  `,
})
export class DonutChartComponent {
  readonly segments = input.required<DonutSegment[]>();
  readonly centerLabel = input('Total');
  readonly size = input(VIEW);

  readonly view = VIEW;
  readonly radius = RADIUS;
  readonly stroke = STROKE;

  private readonly circumference = 2 * Math.PI * RADIUS;

  readonly total = computed(() => this.segments().reduce((sum, s) => sum + s.value, 0));

  readonly rendered = computed<RenderedSegment[]>(() => {
    const total = this.total();
    if (!total) return [];

    let consumed = 0;
    return this.segments().map((s) => {
      const fraction = s.value / total;
      const dash = fraction * this.circumference;
      const segment: RenderedSegment = {
        ...s,
        dash,
        gap: this.circumference - dash,
        offset: -consumed,
        pct: Math.round(fraction * 1000) / 10,
      };
      consumed += dash;
      return segment;
    });
  });
}
