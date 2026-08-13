import { Role } from './auth.service';

/**
 * Capability-based permissions. Screens and actions check capabilities rather than
 * roles directly, so adding a role never means touching call sites.
 */
export type Permission =
  // viewing
  | 'overview.view'
  | 'warehouse.view'
  | 'inventory.view'
  | 'lot.view'
  | 'movement.view'
  | 'reservation.view'
  | 'receiving.view'
  | 'putaway.view'
  | 'wave.view'
  | 'picking.view'
  | 'packing.view'
  | 'shipping.view'
  | 'cycleCount.view'
  | 'exception.view'
  | 'traceability.view'
  | 'controlTower.view'
  | 'audit.view'
  | 'settings.view'
  // acting
  | 'warehouse.create'
  | 'location.manage'
  | 'wave.create'
  | 'wave.release'
  | 'wave.editReleased'
  | 'putaway.accept'
  | 'receiving.create'
  | 'receiving.process'
  | 'picking.execute'
  | 'picking.assign'
  | 'packing.verify'
  | 'packing.approveWeight'
  | 'shipping.manage'
  | 'cycleCount.create'
  | 'cycleCount.execute'
  | 'inventory.adjust'
  | 'inventory.create'
  | 'lot.manage'
  | 'exception.resolve'
  | 'reservation.override'
  | 'reservation.create'
  | 'settings.manage';

const ALL_VIEWS: Permission[] = [
  'overview.view',
  'warehouse.view',
  'inventory.view',
  'lot.view',
  'movement.view',
  'reservation.view',
  'receiving.view',
  'putaway.view',
  'wave.view',
  'picking.view',
  'packing.view',
  'shipping.view',
  'cycleCount.view',
  'exception.view',
  'traceability.view',
  'controlTower.view',
  'audit.view',
  'settings.view',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Executes floor work; cannot plan waves or change configuration.
  'warehouse-operator': [
    'overview.view',
    'inventory.view',
    'lot.view',
    'receiving.view',
    'putaway.view',
    'picking.view',
    'packing.view',
    'shipping.view',
    'cycleCount.view',
    'exception.view',
    'putaway.accept',
    'receiving.process',
    'picking.execute',
    'packing.verify',
    'cycleCount.execute',
  ],
  // Owns task assignment, wave planning, capacity and exception decisions.
  'shift-lead': [
    ...ALL_VIEWS.filter((p) => p !== 'settings.view' && p !== 'audit.view'),
    'wave.create',
    'wave.release',
    'wave.editReleased',
    'putaway.accept',
    'receiving.process',
    'picking.execute',
    'picking.assign',
    'packing.verify',
    'exception.resolve',
    'packing.approveWeight',
  ],
  // Owns lot/serial, variance, quarantine and correction processes.
  'inventory-controller': [
    ...ALL_VIEWS.filter((p) => p !== 'settings.view'),
    'cycleCount.create',
    'cycleCount.execute',
    'inventory.adjust',
    'inventory.create',
    'lot.manage',
    'exception.resolve',
    'reservation.override',
    'reservation.create',
    'putaway.accept',
  ],
  // Owns package, carrier, loading and shipment closure.
  'shipping-specialist': [
    'overview.view',
    'inventory.view',
    'reservation.view',
    'packing.view',
    'shipping.view',
    'wave.view',
    'exception.view',
    'traceability.view',
    'controlTower.view',
    'packing.approveWeight',
    'packing.verify',
    'shipping.manage',
  ],
  // Owns order priority, wave rules and capacity scenarios.
  planner: [
    'overview.view',
    'warehouse.view',
    'inventory.view',
    'reservation.view',
    'wave.view',
    'picking.view',
    'shipping.view',
    'controlTower.view',
    'traceability.view',
    'wave.create',
    'wave.release',
    'wave.editReleased',
    'reservation.override',
    'reservation.create',
  ],
  // Full access, including configuration and the audit trail.
  'warehouse-manager': [
    ...ALL_VIEWS,
    'warehouse.create',
    'location.manage',
    'wave.create',
    'wave.release',
    'wave.editReleased',
    'putaway.accept',
    'receiving.create',
    'receiving.process',
    'picking.execute',
    'picking.assign',
    'packing.verify',
    'packing.approveWeight',
    'shipping.manage',
    'cycleCount.create',
    'cycleCount.execute',
    'inventory.adjust',
    'inventory.create',
    'lot.manage',
    'exception.resolve',
    'reservation.override',
    'reservation.create',
    'settings.manage',
  ],
};

/**
 * Data-scope rule: which warehouses a role may see. Floor roles are pinned to their
 * home warehouse; planning and management roles see the whole network.
 */
export const ROLE_WAREHOUSE_SCOPE: Record<Role, 'all' | 'home'> = {
  'warehouse-operator': 'home',
  'shift-lead': 'home',
  'inventory-controller': 'all',
  'shipping-specialist': 'all',
  planner: 'all',
  'warehouse-manager': 'all',
};

export interface RoleOption {
  value: Role;
}

/** Single source for the role catalog — used by both the Login screen and Settings. */
export const ROLE_CATALOG: RoleOption[] = [
  { value: 'warehouse-operator' },
  { value: 'shift-lead' },
  { value: 'inventory-controller' },
  { value: 'shipping-specialist' },
  { value: 'planner' },
  { value: 'warehouse-manager' },
];
