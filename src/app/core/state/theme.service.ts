import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'wavent.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly current = signal<Theme>(this.readInitial());

  readonly theme = this.current.asReadonly();

  constructor() {
    effect(() => {
      const theme = this.current();
      document.documentElement.setAttribute('data-theme', theme);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // storage unavailable (private mode) — theme stays session-only
      }
    });
  }

  set(theme: Theme): void {
    this.current.set(theme);
  }

  private readInitial(): Theme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch {
      // ignore
    }
    return 'dark';
  }
}
