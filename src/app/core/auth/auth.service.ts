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

/** One demo persona per role, so logging in as a different role also feels like a different person. */
const DEMO_USERS: Record<Role, CurrentUser> = {
  'warehouse-operator': { id: 'u-op', name: 'Mehmet Yıldız', role: 'warehouse-operator', homeWarehouseCode: 'NYC-01' },
  'shift-lead': { id: 'u-lead', name: 'Ayşe Kaya', role: 'shift-lead', homeWarehouseCode: 'NYC-01' },
  'inventory-controller': { id: 'u-inv', name: 'Elif Demir', role: 'inventory-controller', homeWarehouseCode: 'NYC-01' },
  'shipping-specialist': { id: 'u-ship', name: 'Can Öztürk', role: 'shipping-specialist', homeWarehouseCode: 'NYC-01' },
  planner: { id: 'u-plan', name: 'Zeynep Aydın', role: 'planner', homeWarehouseCode: 'NYC-01' },
  'warehouse-manager': { id: 'u-1', name: 'John Doe', role: 'warehouse-manager', homeWarehouseCode: 'NYC-01' },
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly user = signal<CurrentUser>(DEMO_USERS['warehouse-manager']);
  private readonly authenticated = signal(false);

  readonly currentUser = this.user.asReadonly();
  readonly role = computed(() => this.user().role);
  readonly isAuthenticated = this.authenticated.asReadonly();

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

  /** Login screen: picking a role signs in as that role's demo persona. */
  login(role: Role): void {
    this.user.set(DEMO_USERS[role]);
    this.authenticated.set(true);
  }

  logout(): void {
    this.authenticated.set(false);
  }
}
