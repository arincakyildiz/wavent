import { Signal, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { describeError } from '../../core/api/api-error';
import { ListQuery, ListResult } from './list-query';
import { I18nService } from '../../core/i18n/i18n.service';

export interface ListResource<T> {
  rows: Signal<T[]>;
  total: Signal<number>;
  totalPages: Signal<number>;
  page: Signal<number>;
  loading: Signal<boolean>;
  error: Signal<string | null>;
  /** Re-issues the current query, e.g. after a write or an error. */
  reload: () => void;
}

/**
 * Wires a paged, filtered, sorted list to a service call.
 *
 * Every list screen needs the same four things — a request derived from filter
 * signals, a switchMap so a stale response cannot overwrite a newer one, an error
 * branch, and a manual reload. Doing it once here keeps the screens focused on
 * their columns and actions.
 *
 * Must be called from an injection context (a component field initializer).
 */
export function createListResource<T>(
  request: Signal<{ scope: string[]; query: ListQuery }>,
  fetch: (scope: string[], query: ListQuery) => Observable<ListResult<T>>,
): ListResource<T> {
  const error = signal<string | null>(null);
  const token = signal(0);
  // Rows can carry server-derived text (rule violations, reasons), so a language
  // switch has to re-issue the query rather than leave stale wording on screen.
  const locale = inject(I18nService).locale;

  const source = computed(() => ({ ...request(), token: token(), locale: locale() }));

  const result = toSignal(
    toObservable(source).pipe(
      switchMap(({ scope, query }) => {
        error.set(null);
        return fetch(scope, query).pipe(
          catchError((err) => {
            error.set(describeError(err));
            return of(null);
          }),
        );
      }),
    ),
    { initialValue: undefined },
  );

  return {
    rows: computed(() => result()?.rows ?? []),
    total: computed(() => result()?.total ?? 0),
    totalPages: computed(() => result()?.totalPages ?? 1),
    page: computed(() => result()?.page ?? 1),
    // `undefined` means "no response yet"; `null` means the call failed.
    loading: computed(() => result() === undefined && error() === null),
    error: error.asReadonly(),
    reload: () => {
      error.set(null);
      token.update((n) => n + 1);
    },
  };
}
