import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { I18nService } from '../i18n/i18n.service';

export interface WarehouseOption {
  code: string;
  name: string;
}

/** Kept here (not in a feature service) because the shell and every list depend on it. */
const WAREHOUSES: WarehouseOption[] = [
  { code: 'NYC-01', name: 'New York DC' },
  { code: 'AMS-01', name: 'Amsterdam Hub' },
  { code: 'IST-01', name: 'Istanbul Merkez' },
  { code: 'DXB-01', name: 'Dubai Logistics Park' },
  { code: 'GRU-01', name: 'Sao Paulo Cross-dock' },
];

export const ALL_WAREHOUSES = 'all';

/**
 * Global warehouse scope. Two things narrow the data a user sees:
 *  1. their role's data scope ('home' roles are pinned to one warehouse), and
 *  2. the scope they pick in the topbar.
 * Lists filter on `activeCodes()` so both rules apply in one place.
 */
@Injectable({ providedIn: 'root' })
export class WarehouseScopeService {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly selection = signal<string>(ALL_WAREHOUSES);
  private readonly registeredWarehouses = signal<WarehouseOption[]>([]);

  private readonly available = computed(() => [...WAREHOUSES, ...this.registeredWarehouses()]);

  /** Warehouses the current role is allowed to see at all. */
  readonly permitted = computed<WarehouseOption[]>(() => {
    const user = this.auth.currentUser();
    const available = this.available();
    if (this.auth.warehouseScope() === 'all') return available;
    return available.filter((w) => w.code === user.homeWarehouseCode);
  });

  /** The selection, corrected when the role no longer permits it. */
  readonly selected = computed<string>(() => {
    const permitted = this.permitted();
    if (permitted.length === 1) return permitted[0].code;

    const current = this.selection();
    if (current === ALL_WAREHOUSES) return ALL_WAREHOUSES;
    return permitted.some((w) => w.code === current) ? current : ALL_WAREHOUSES;
  });

  /** Concrete codes to filter by — never empty. */
  readonly activeCodes = computed<string[]>(() => {
    const selected = this.selected();
    const permitted = this.permitted().map((w) => w.code);
    return selected === ALL_WAREHOUSES ? permitted : [selected];
  });

  readonly canChoose = computed(() => this.permitted().length > 1);

  readonly label = computed(() => {
    const selected = this.selected();
    if (selected === ALL_WAREHOUSES) return this.i18n.t('nav.allWarehouses');
    return this.permitted().find((w) => w.code === selected)?.name ?? selected;
  });

  select(code: string): void {
    this.selection.set(code);
  }

  register(warehouse: WarehouseOption): void {
    if (this.available().some((item) => item.code === warehouse.code)) return;
    this.registeredWarehouses.update((items) => [...items, warehouse]);
  }

  resetRegistered(): void {
    this.registeredWarehouses.set([]);
    this.selection.set(ALL_WAREHOUSES);
  }

  /** True when a row belonging to `code` is in scope. */
  includes(code: string): boolean {
    return this.activeCodes().includes(code);
  }
}
