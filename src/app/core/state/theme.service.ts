import { Injectable, effect, inject, signal } from '@angular/core';
import { LocalStorageService } from '../storage/local-storage.service';

export type Theme = 'dark' | 'light';

/** The adapter namespaces keys, so this stays the bare name. */
const STORAGE_KEY = 'theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storage = inject(LocalStorageService);
  private readonly current = signal<Theme>(this.readInitial());

  readonly theme = this.current.asReadonly();

  constructor() {
    effect(() => {
      const theme = this.current();
      document.documentElement.setAttribute('data-theme', theme);
      // The adapter swallows quota / private-mode failures, so switching themes
      // never breaks just because persistence is unavailable.
      this.storage.writeRaw(STORAGE_KEY, theme);
    });
  }

  set(theme: Theme): void {
    this.current.set(theme);
  }

  private readInitial(): Theme {
    const stored = this.storage.readRaw(STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : 'dark';
  }
}
