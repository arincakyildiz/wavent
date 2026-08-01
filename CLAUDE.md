# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Wavent — an Angular 19 (standalone + Signals) advanced WMS control panel covering warehouse
topology, lot/serial traceability, FEFO/FIFO reservation, wave planning, pick-pack-ship and
exception handling. There is no backend: a mock transport layer simulates latency, failures and
optimistic-concurrency conflicts.

UI text is Turkish; code, comments and identifiers are English.

## Commands

```bash
npm start                    # dev server on :4200
npm run build                # production build (also the authoritative template type-check)
npm test                     # Karma + Jasmine, watch mode
npx ng test --watch=false --browsers=ChromeHeadless   # single CI-style run
npx tsc -p tsconfig.app.json --noEmit                 # fast TS-only check, skips templates
```

Run a single spec by narrowing with Jasmine's focus (`fdescribe` / `fit`) — there is no
`--include` flag configured for the Karma builder.

**Testing a component built on `createListResource`:** the request pipeline is driven by
`toObservable()`, whose producer effect does not flush deterministically under `fakeAsync()` +
`tick()` — the exact number of ticks/`detectChanges()` calls needed varies with what ran earlier
in the suite, so a fixed-tick test can pass alone and fail (or vice versa) once other specs run
before it. Use a real `async () => { fixture.detectChanges(); await fixture.whenStable(); }` test
instead for the "list loaded" assertion; `fakeAsync` is fine for everything that doesn't depend on
that effect (e.g. a direct service call after a confirm-dialog spy).

**Template errors only surface in `ng build` / `ng serve`,** not in `tsc --noEmit`. After editing
templates, run a build before claiming it compiles.

### Environment caveat (resolved)

The repo originally lived under `~/Desktop`, which is iCloud-synced on this machine, on a disk
that had run to ~97% full. That combination produced hung `ng build` processes at 0% CPU (up to
15+ minutes with no output), esbuild `EPIPE`/`write EPIPE` crashes, and once a
`node_modules/ajv/package.json` corrupted to NUL bytes. `mv` off of `~/Desktop` was itself affected
— iCloud materializes every file during the move, so it silently stalled on `node_modules`.

**Fix applied:** the project now lives at `~/dev/wavent`, outside any iCloud-synced folder, with
`node_modules` reinstalled fresh at the new location (a straight `mv`/`rsync` of a corrupted
`node_modules` would have carried the corruption over). `npm install` now takes ~12s and
`ng build` ~3-6s, down from indefinite hangs. If the project is ever moved back under `~/Desktop`,
`~/Library`, or another iCloud/Dropbox-style synced folder, expect these symptoms to return —
move it back out rather than debugging the build.

Note `pgrep -f "ng build"` matches its own watcher shell; do not use it alone to decide whether a
build is still running. Check `%CPU` and elapsed time (`ps -o pid,etime,%cpu -p <pid>`) — a build
truly stuck shows `0.0%` CPU for minutes, not just a process entry.

## Architecture

### Layering

```
core/      api (mock transport, ApiError, fault injection), auth (roles, permissions, guard),
           observability (audit, notifications), state (theme, confirm dialog, warehouse scope)
shared/    presentational components, directives, validators, list/query utils
features/advanced-wms/
           pages/        route-level screens
           components/   feature dialogs (create forms)
           data-access/  services + mock-data + selectors
           models/       entities.ts (interfaces + enums)
```

UI components never touch data directly — they call a `data-access` service, which reads the
shared dataset and derives values through `selectors.ts`.

### The single dataset — `data-access/mock-data.ts`

One seeded generator (`mulberry32`, fixed seed) builds the whole relational dataset at module
load: warehouses → locations → SKUs → balances → orders → **allocations (a real FEFO/FIFO
engine)** → waves → pick tasks → packages → shipments, plus ASNs, putaway, cycle counts,
exceptions, movements and seeded audit events.

Because it is one graph, counts and quantities agree across screens. When adding data, extend the
generator rather than inlining a new array in a service, or cross-screen consistency breaks.

Services **mutate `db` in place** to simulate persistence within a session (e.g.
`WavesService.release` flips a wave's status and bumps `version`). This is intentional; there is
no reset between navigations.

### The derivation layer — `data-access/selectors.ts`

All computed quantities and business-rule verdicts live here, so Inventory, the SKU detail and the
Control Tower can never disagree. It also exports the rule predicates that the unit tests assert
against:

`isReservable`, `fitsCapacity`, `fefoViolation`, `requiresSecondCount`, `withinWeightTolerance`,
`stockIsBalanced`, `waveOrderStatuses`, `traceLot`.

Put new business rules here as pure functions, not inside components.

### Mock transport & failure simulation

`MockApiService.simulate(data, { delayMs, kind, failWith })` wraps a value in a `defer`red
observable so a retry re-rolls the failure decision. Errors are `ApiError` with a `kind`
(`network | unauthorized | forbidden | conflict | not-found | validation`) and an HTTP-ish status.

`FaultInjectionService` is the switchboard — the Settings screen drives read/write failure rates,
extra latency, and one-shot armed failures, so every error path is demonstrable without editing
code.

Writes use optimistic concurrency: callers pass the `version` they read, and
`MockApiService.assertVersion` raises a `conflict` carrying the winning version.

### List screens

Every list uses the same three pieces, so follow the existing pattern rather than hand-rolling:

- `shared/utils/list-query.ts` — `runQuery()` applies search, equality filters, sort and
  pagination server-side-style and returns a `total` (so pagination is real, not a client slice).
- `shared/utils/list-resource.ts` — `createListResource(request, fetch)` wires a request signal to
  a service call with `switchMap` (stale responses cannot overwrite newer ones), an error branch
  and `reload()`. Must be called from an injection context.
- `shared/utils/query-params.ts` — `bindQueryParams([...])` two-way binds filter signals to URL
  query params with `replaceUrl`, so filtered views are shareable.

Sorting comes from `SortableDirective` on `<th>`; keyboard-reachable rows come from
`ActivatableDirective` (a `<tr>` with only a click handler is mouse-only).

Stock Movements is the exception: it virtualises with `@angular/cdk` `cdk-virtual-scroll-viewport`
over a CSS-grid "table" (a `<tbody>` cannot be virtualised), using one huge page instead of
pagination.

### Authorization

Capability-based, not role-checks-at-call-sites. `permissions.ts` maps each `Role` to a flat
`Permission[]` plus a data scope (`all` | `home`).

- Routes: `canActivate: [requirePermission('wave.view')]` — blocks the lazy bundle too, and
  redirects to `/wms/unauthorized` (a real 403 screen).
- Actions: `*appHasPermission="'wave.release'"` removes the control from the DOM.
- Menu: the shell filters `navGroups` by the same permissions, so navigation mirrors the guards.
- Data: `WarehouseScopeService.activeCodes()` combines the role's scope with the topbar selector;
  every list filters on it.

Settings can switch the active role at runtime to preview the app as another role.

### Cross-cutting UI services

- `ConfirmDialogService.ask({ requireReason })` returns an observable — critical operations only
  proceed on `confirmed: true`, and the dialog's Reactive Form enforces the justification.
- `AuditService.record()` — every rule-governed action (release, override, approval, creation)
  writes here; the Audit Log merges these live events with the seeded history.
- `NotificationService` + `ToastHostComponent` — used for optimistic-update rollbacks, which pass
  a `retry` callback into the toast.

Both the toast host and the confirm dialog are mounted once, in `ShellComponent`.

### Design system

Zero UI dependencies. Icons, sparkline, donut, bar chart and the dotted world map are all inline
SVG under `shared/components/`. The world map filters a lat/lon dot grid through hand-written
continent polygons with a point-in-polygon test, computed once per bundle.

Theming is CSS custom properties in `src/styles.scss` under `:root[data-theme='dark'|'light']`;
`ThemeService` writes `data-theme` on the root element and persists to `localStorage`. Shared
classes (`.panel`, `.data-table`, `.kpi-card`, `.status-pill`, `.form`, `.field`, tone modifiers
like `.tone-danger`) live in `styles.scss` — reuse them instead of adding component-local
equivalents.
