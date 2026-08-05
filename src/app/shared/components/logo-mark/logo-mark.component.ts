import { Component, input } from '@angular/core';

/**
 * The Wavent brand mark — a folded ribbon "W" with a small warehouse/growth-arrow
 * badge tucked into the right stroke. Fixed brand colors (not theme tokens): the
 * mark reads the same in light and dark shells, same as any vector logo would.
 */
@Component({
  selector: 'app-logo-mark',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="wavent-ribbon" x1="4" y1="14" x2="58" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#FFAD54" />
          <stop offset="1" stop-color="#FF6A00" />
        </linearGradient>
      </defs>

      <path
        d="M10 17 L24 47 L32 30 L40 47 L54 17"
        stroke="url(#wavent-ribbon)"
        stroke-width="9"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path d="M29.3 33 L32 27.5 L34.7 33 L32 36.5 Z" fill="#D9520A" opacity="0.45" />

      @if (detailed()) {
        <circle cx="47.5" cy="18" r="13.5" fill="#FFFFFF" />
        <path d="M39 24 L54 8" stroke="#1C2536" stroke-width="3" stroke-linecap="round" />
        <path d="M54 8 L47.5 9.5 L52.5 14.5 Z" fill="#1C2536" />
        <path d="M40.5 22 L47 16 L53.5 22" stroke="#1C2536" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
        <rect x="42" y="22" width="10" height="6.5" rx="1" fill="#1C2536" />
        <rect x="45.6" y="24.6" width="2.8" height="3.9" rx="0.5" fill="#FFFFFF" />
      }
    </svg>
  `,
})
export class LogoMarkComponent {
  /** Pixel size (square). */
  readonly size = input(28);
  /** Adds the warehouse/arrow badge — turned off where the mark renders too small to read it (e.g. collapsed sidebar). */
  readonly detailed = input(true);
}
