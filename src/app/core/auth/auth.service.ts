import { Injectable, computed, signal } from '@angular/core';

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
}

const DEMO_USER: CurrentUser = {
  id: 'u-1',
  name: 'John Doe',
  role: 'warehouse-manager',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly user = signal<CurrentUser>(DEMO_USER);

  readonly currentUser = this.user.asReadonly();
  readonly role = computed(() => this.user().role);

  hasRole(...roles: Role[]): boolean {
    return roles.includes(this.user().role);
  }

  /** Demo affordance: lets the Settings screen preview the app as another role. */
  setRole(role: Role): void {
    this.user.update((user) => ({ ...user, role }));
  }
}
