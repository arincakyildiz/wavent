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
  | 'wave.create'
  | 'wave.release'
  | 'putaway.accept'
  | 'receiving.create'
  | 'packing.approveWeight'
  | 'cycleCount.create'
  | 'exception.resolve'
  | 'reservation.override'
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
  ],
  // Owns task assignment, wave planning, capacity and exception decisions.
  'shift-lead': [
    ...ALL_VIEWS.filter((p) => p !== 'settings.view' && p !== 'audit.view'),
    'wave.create',
    'wave.release',
    'putaway.accept',
    'exception.resolve',
    'packing.approveWeight',
  ],
  // Owns lot/serial, variance, quarantine and correction processes.
  'inventory-controller': [
    ...ALL_VIEWS.filter((p) => p !== 'settings.view'),
    'cycleCount.create',
    'exception.resolve',
    'reservation.override',
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
    'reservation.override',
  ],
  // Full access, including configuration and the audit trail.
  'warehouse-manager': [
    ...ALL_VIEWS,
    'warehouse.create',
    'wave.create',
    'wave.release',
    'putaway.accept',
    'receiving.create',
    'packing.approveWeight',
    'cycleCount.create',
    'exception.resolve',
    'reservation.override',
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
  label: string;
  description: string;
}

/** Single source for the role catalog — used by both the Login screen and Settings. */
export const ROLE_CATALOG: RoleOption[] = [
  {
    value: 'warehouse-operator',
    label: 'Depo Operatörü',
    description: 'Kabul, putaway, toplama, paketleme, sayım ve barkod işlemleri',
  },
  {
    value: 'shift-lead',
    label: 'Vardiya Lideri',
    description: 'Görev atama, dalga planı, kapasite ve istisna kararları',
  },
  {
    value: 'inventory-controller',
    label: 'Stok Kontrol Uzmanı',
    description: 'Lot/seri, sayım farkı, karantina ve düzeltme süreçleri',
  },
  {
    value: 'shipping-specialist',
    label: 'Sevkiyat Uzmanı',
    description: 'Paket, taşıyıcı, yükleme ve sevkiyat kapanışı',
  },
  {
    value: 'planner',
    label: 'Planlama Uzmanı',
    description: 'Sipariş önceliği, dalga kuralı ve kapasite senaryoları',
  },
  {
    value: 'warehouse-manager',
    label: 'Depo Yöneticisi',
    description: 'Depo, lokasyon, kural, rol ve KPI ayarları',
  },
];
