import { DestroyRef, WritableSignal, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

export interface QueryParamBinding<T> {
  /** Query parameter name as it appears in the URL. */
  param: string;
  signal: WritableSignal<T>;
  /** Omitted from the URL when the value equals this, keeping links clean. */
  defaultValue: T;
  parse: (raw: string) => T;
  serialize?: (value: T) => string;
}

/**
 * Two-way binds signals to URL query parameters so a filtered list view is
 * shareable and survives reload/back-forward.
 *
 * Must be called from an injection context (a component constructor). Reads the URL
 * once on init, then keeps the URL in step with the signals via `replaceUrl` so
 * filtering does not flood browser history.
 */
// `any` here is deliberate: each entry carries its own value type, and a single
// generic parameter cannot describe a heterogeneous array of bindings.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function bindQueryParams(bindings: readonly QueryParamBinding<any>[]): void {
  const router = inject(Router);
  const route = inject(ActivatedRoute);
  const destroyRef = inject(DestroyRef);

  let applyingFromUrl = false;

  route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe((map) => {
    applyingFromUrl = true;
    try {
      for (const binding of bindings) {
        const raw = map.get(binding.param);
        const next = raw === null ? binding.defaultValue : binding.parse(raw);
        if (untracked(binding.signal) !== next) {
          binding.signal.set(next);
        }
      }
    } finally {
      applyingFromUrl = false;
    }
  });

  effect(() => {
    // Read every signal so the effect re-runs when any of them changes.
    const values = bindings.map((b) => ({ binding: b, value: b.signal() }));
    if (applyingFromUrl) return;

    const queryParams: Record<string, string | null> = {};
    for (const { binding, value } of values) {
      const isDefault = value === binding.defaultValue;
      queryParams[binding.param] = isDefault
        ? null
        : (binding.serialize ?? String)(value);
    }

    untracked(() => {
      void router.navigate([], {
        relativeTo: route,
        queryParams,
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  });
}

/** Common parsers, so call sites stay short. */
export const parseString = (raw: string): string => raw;
export const parseNumber = (fallback: number) => (raw: string): number => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};
