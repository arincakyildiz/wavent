import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService, Role } from './auth.service';
import { requirePermission } from './permission.guard';
import { Permission, ROLE_PERMISSIONS, ROLE_WAREHOUSE_SCOPE } from './permissions';

const ROLES: Role[] = [
  'warehouse-operator',
  'shift-lead',
  'inventory-controller',
  'shipping-specialist',
  'planner',
  'warehouse-manager',
];

const ACTION_PERMISSIONS: Permission[] = [
  'warehouse.create', 'location.manage', 'wave.create', 'wave.release', 'wave.editReleased',
  'putaway.accept', 'receiving.create', 'receiving.process', 'picking.execute', 'picking.assign',
  'packing.verify', 'packing.approveWeight', 'shipping.manage', 'cycleCount.create',
  'cycleCount.execute', 'inventory.adjust', 'inventory.create', 'lot.manage', 'exception.resolve',
  'reservation.override', 'reservation.create', 'settings.manage',
];

describe('permission map', () => {
  it('defines permissions and a data scope for every role', () => {
    for (const role of ROLES) {
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
      expect(ROLE_WAREHOUSE_SCOPE[role]).toBeDefined();
    }
  });

  it('never lists a permission twice for a role', () => {
    for (const role of ROLES) {
      const list = ROLE_PERMISSIONS[role];
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('grants configuration only to the warehouse manager', () => {
    const withSettings = ROLES.filter((r) => ROLE_PERMISSIONS[r].includes('settings.manage'));
    expect(withSettings).toEqual(['warehouse-manager']);
  });

  it('keeps floor operators away from wave release', () => {
    expect(ROLE_PERMISSIONS['warehouse-operator']).not.toContain('wave.release');
  });

  it('pins floor roles to their home warehouse', () => {
    expect(ROLE_WAREHOUSE_SCOPE['warehouse-operator']).toBe('home');
    expect(ROLE_WAREHOUSE_SCOPE['warehouse-manager']).toBe('all');
  });

  it('matches the complete action matrix for all six roles', () => {
    const expected: Record<Role, Permission[]> = {
      'warehouse-operator': ['putaway.accept', 'receiving.process', 'picking.execute', 'packing.verify', 'cycleCount.execute'],
      'shift-lead': ['wave.create', 'wave.release', 'wave.editReleased', 'putaway.accept', 'receiving.process', 'picking.execute', 'picking.assign', 'packing.verify', 'packing.approveWeight', 'exception.resolve'],
      'inventory-controller': ['putaway.accept', 'cycleCount.create', 'cycleCount.execute', 'inventory.adjust', 'inventory.create', 'lot.manage', 'exception.resolve', 'reservation.override', 'reservation.create'],
      'shipping-specialist': ['packing.verify', 'packing.approveWeight', 'shipping.manage'],
      planner: ['wave.create', 'wave.release', 'wave.editReleased', 'reservation.override', 'reservation.create'],
      'warehouse-manager': ACTION_PERMISSIONS,
    };

    for (const role of ROLES) {
      expect(ROLE_PERMISSIONS[role].filter((permission) => ACTION_PERMISSIONS.includes(permission)).sort())
        .withContext(role)
        .toEqual(expected[role].sort());
    }
  });
});

describe('AuthService capabilities', () => {
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => auth.logout());

  it('answers `can` from the active role', () => {
    auth.setRole('warehouse-operator');
    expect(auth.can('putaway.accept')).toBe(true);
    expect(auth.can('settings.manage')).toBe(false);
  });

  it('recomputes capabilities when the role changes', () => {
    auth.setRole('warehouse-operator');
    expect(auth.can('wave.release')).toBe(false);

    auth.setRole('shift-lead');
    expect(auth.can('wave.release')).toBe(true);
  });

  it('reports the role data scope', () => {
    auth.setRole('shift-lead');
    expect(auth.warehouseScope()).toBe('home');

    auth.setRole('planner');
    expect(auth.warehouseScope()).toBe('all');
  });

  it('persists login and clears the session on logout', () => {
    auth.login('planner');
    expect(localStorage.getItem('wavent.auth-session-v1')).toBe('"planner"');

    auth.logout();
    expect(localStorage.getItem('wavent.auth-session-v1')).toBeNull();
  });
});

describe('requirePermission guard', () => {
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => auth.logout());

  function run(permission: Parameters<typeof requirePermission>[0]) {
    const guard = requirePermission(permission);
    return TestBed.runInInjectionContext(() =>
      guard({ routeConfig: { path: 'settings' } } as never, {} as never),
    );
  }

  it('allows a role that holds the permission', () => {
    auth.setRole('warehouse-manager');
    expect(run('settings.view')).toBe(true);
  });

  it('redirects a role that lacks the permission to the 403 screen', () => {
    auth.setRole('warehouse-operator');
    const result = run('settings.view');
    expect(result).not.toBe(true);
    expect(router.serializeUrl(result as never)).toContain('/wms/unauthorized');
  });
});
