import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
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
/**
 * Module-level handle onto the singleton, so *pure* functions — the business rules in
 * `selectors.ts` / `stock-rules.ts` and the service error messages — can translate
 * without being turned into injectables. `I18nService` registers itself on construction.
 */
let active: I18nService | null = null;

/** Translates from non-injectable code. Falls back to the Turkish catalog before boot. */
export function translate(key: string, params?: Record<string, string | number>): string {
  if (active) return active.t(key, params);

  const text = TR[key] ?? key;
  if (!params) return text;
  return Object.entries(params).reduce(
    (acc, [name, value]) => acc.split(`{${name}}`).join(String(value)),
    text,
  );
}

@Injectable({ providedIn: 'root' })
export class I18nService implements OnDestroy {
  private readonly storage = inject(LocalStorageService);
  private readonly current = signal<Locale>(this.readInitial());

  readonly locale = this.current.asReadonly();
  readonly locales = LOCALES;

  private readonly messages = computed(() => CATALOGS[this.current()]);

  constructor() {
    // Pure business-rule helpers use this module-level bridge outside injection contexts.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    active = this;
  }

  /**
   * Releases the module-level handle when the injector goes away. Without this a
   * torn-down service keeps answering `translate()` calls — invisible in the app,
   * which has one injector, but it leaks a locale between tests.
   */
  ngOnDestroy(): void {
    if (active === this) active = null;
  }

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

  /**
   * Locale-aware number grouping.
   *
   * Angular's `DecimalPipe` reads `LOCALE_ID`, which is fixed at bootstrap and cannot
   * change without a reload — so it would render `1,234` to a Turkish reader forever.
   * This reads the locale signal instead, which both formats correctly and re-renders
   * the cell when the language changes, exactly like `t()`.
   */
  n(value: number | null | undefined, maximumFractionDigits = 0): string {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat(this.current(), { maximumFractionDigits }).format(value);
  }

  /** Locale-aware date/time, for the same reason `n()` exists. */
  d(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(this.current(), {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
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
