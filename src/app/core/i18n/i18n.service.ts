import { Injectable, computed, inject, signal } from '@angular/core';
import { LocalStorageService } from '../storage/local-storage.service';
import { EN } from './locales/en';
import { TR } from './locales/tr';

export type Locale = 'tr' | 'en';

export const LOCALES: { code: Locale; label: string; short: string }[] = [
  { code: 'tr', label: 'Türkçe', short: 'TR' },
  { code: 'en', label: 'English', short: 'EN' },
];

const STORAGE_KEY = 'locale';
const DEFAULT_LOCALE: Locale = 'tr';

const CATALOGS: Record<Locale, Record<string, string>> = { tr: TR, en: EN };

/**
 * Runtime translation, signal-based.
 *
 * Angular's built-in i18n is compile-time — it produces one bundle per locale — so it
 * cannot switch language without a reload. This keeps the whole catalog in memory and
 * swaps a signal instead, which is what makes the toggle instant.
 *
 * `t()` reads the locale signal, so calling it from a template registers a dependency
 * and every visible string re-renders when the language changes. No pipe required.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly storage = inject(LocalStorageService);
  private readonly current = signal<Locale>(this.readInitial());

  readonly locale = this.current.asReadonly();
  readonly locales = LOCALES;

  private readonly messages = computed(() => CATALOGS[this.current()]);

  /**
   * Looks up `key`, substituting `{name}` placeholders.
   *
   * An unknown key falls back to Turkish and finally to the key itself rather than
   * rendering empty — a visible key is a bug report; blank space hides one.
   */
  t(key: string, params?: Record<string, string | number>): string {
    const text = this.messages()[key] ?? TR[key] ?? key;
    if (!params) return text;

    return Object.entries(params).reduce(
      (acc, [name, value]) => acc.split(`{${name}}`).join(String(value)),
      text,
    );
  }

  set(locale: Locale): void {
    this.current.set(locale);
    this.storage.writeRaw(STORAGE_KEY, locale);
    document.documentElement.setAttribute('lang', locale);
  }

  private readInitial(): Locale {
    const stored = this.storage.readRaw(STORAGE_KEY);
    const locale: Locale = stored === 'tr' || stored === 'en' ? stored : DEFAULT_LOCALE;
    document.documentElement.setAttribute('lang', locale);
    return locale;
  }
}
