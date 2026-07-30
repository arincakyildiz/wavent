import { Component, computed, input } from '@angular/core';

/** Minimal trend line for KPI cards — pure SVG, no charting dependency. */
@Component({
  selector: 'app-sparkline',
  standalone: true,
  template: `
    <svg [attr.viewBox]="'0 0 ' + width() + ' ' + height()" [attr.width]="width()" [attr.height]="height()" aria-hidden="true">
      <defs>
        <linearGradient [attr.id]="gradientId()" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" [attr.stop-color]="color()" stop-opacity="0.28" />
          <stop offset="100%" [attr.stop-color]="color()" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path [attr.d]="areaPath()" [attr.fill]="'url(#' + gradientId() + ')'" />
      <path [attr.d]="linePath()" fill="none" [attr.stroke]="color()" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,
  styles: `
    :host {
      display: block;
      line-height: 0;
    }
  `,
})
export class SparklineComponent {
  readonly points = input.required<number[]>();
  readonly color = input('#3b82f6');
  readonly width = input(76);
  readonly height = input(26);

  private readonly seed = Math.random().toString(36).slice(2, 8);

  readonly gradientId = computed(() => `spark-${this.seed}`);

  private readonly coords = computed(() => {
    const values = this.points();
    if (values.length < 2) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const pad = 2;
    const usableH = this.height() - pad * 2;
    const stepX = this.width() / (values.length - 1);

    return values.map((v, i) => ({
      x: i * stepX,
      y: pad + usableH - ((v - min) / span) * usableH,
    }));
  });

  readonly linePath = computed(() => {
    const pts = this.coords();
    if (!pts.length) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  });

  readonly areaPath = computed(() => {
    const pts = this.coords();
    if (!pts.length) return '';
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    return `${line} L${this.width()} ${this.height()} L0 ${this.height()} Z`;
  });
}
