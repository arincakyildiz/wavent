import { Injectable, computed, signal } from '@angular/core';
import { Permission, ROLE_PERMISSIONS, ROLE_WAREHOUSE_SCOPE } from './permissions';

export type Role =
  | 'warehouse-operator'
  | 'shift-lead'
  | 'inventory-controller'
  | 'shipping-specialist'
  | 'planner'
  | 'warehouse-manager';

export interface CurrentUser {
  id: string;
  name: string;
  role: Role;
  /** Warehouse the operator is stationed at — drives data scope for floor roles. */
  homeWarehouseCode: string;
}

const DEMO_USER: CurrentUser = {
  id: 'u-1',
  name: 'John Doe',
  role: 'warehouse-manager',
  homeWarehouseCode: 'NYC-01',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly user = signal<CurrentUser>(DEMO_USER);

  readonly currentUser = this.user.asReadonly();
  readonly role = computed(() => this.user().role);

  /** Flat capability set for the active role. */
  readonly permissions = computed(() => new Set<Permission>(ROLE_PERMISSIONS[this.user().role]));

  /** 'all' or 'home' — consumed by WarehouseScopeService to filter data. */
  readonly warehouseScope = computed(() => ROLE_WAREHOUSE_SCOPE[this.user().role]);

  hasRole(...roles: Role[]): boolean {
    return roles.includes(this.user().role);
  }

  can(permission: Permission): boolean {
    return this.permissions().has(permission);
  }

  canAny(...permissions: Permission[]): boolean {
    return permissions.some((p) => this.permissions().has(p));
  }

  /** Demo affordance: lets the Settings screen preview the app as another role. */
  setRole(role: Role): void {
    this.user.update((user) => ({ ...user, role }));
  }
}
