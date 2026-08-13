import { Routes } from '@angular/router';
import { requirePermission } from '../../core/auth/permission.guard';

/**
 * Every screen is guarded by the capability it needs, so an unauthorised role cannot
 * reach it — or download its lazy bundle — by typing the URL.
 */
const WMS_ROUTES: Routes = [
  {
    path: 'overview',
    canActivate: [requirePermission('overview.view')],
    loadComponent: () => import('./pages/overview/overview.component').then((m) => m.OverviewComponent),
  },
  {
    path: 'warehouses',
    canActivate: [requirePermission('warehouse.view')],
    loadComponent: () => import('./pages/warehouses/warehouses.component').then((m) => m.WarehousesComponent),
  },
  {
    path: 'locations',
    canActivate: [requirePermission('warehouse.view')],
    loadComponent: () => import('./pages/locations/locations.component').then((m) => m.LocationsComponent),
  },
  {
    path: 'inventory',
    canActivate: [requirePermission('inventory.view')],
    loadComponent: () => import('./pages/inventory/inventory.component').then((m) => m.InventoryComponent),
  },
  {
    path: 'inventory/:sku',
    canActivate: [requirePermission('inventory.view')],
    loadComponent: () =>
      import('./pages/inventory-detail/inventory-detail.component').then((m) => m.InventoryDetailComponent),
  },
  {
    path: 'lot-serial',
    canActivate: [requirePermission('lot.view')],
    loadComponent: () => import('./pages/lot-serial/lot-serial.component').then((m) => m.LotSerialComponent),
  },
  {
    path: 'stock-movements',
    canActivate: [requirePermission('movement.view')],
    loadComponent: () =>
      import('./pages/stock-movements/stock-movements.component').then((m) => m.StockMovementsComponent),
  },
  {
    path: 'reservations',
    canActivate: [requirePermission('reservation.view')],
    loadComponent: () => import('./pages/reservations/reservations.component').then((m) => m.ReservationsComponent),
  },
  {
    path: 'receiving',
    canActivate: [requirePermission('receiving.view')],
    loadComponent: () => import('./pages/receiving/receiving.component').then((m) => m.ReceivingComponent),
  },
  {
    path: 'receiving/:id',
    canActivate: [requirePermission('receiving.view')],
    loadComponent: () =>
      import('./pages/receiving-detail/receiving-detail.component').then((m) => m.ReceivingDetailComponent),
  },
  {
    path: 'putaway',
    canActivate: [requirePermission('putaway.view')],
    loadComponent: () => import('./pages/putaway/putaway.component').then((m) => m.PutawayComponent),
  },
  {
    path: 'waves',
    canActivate: [requirePermission('wave.view')],
    loadComponent: () => import('./pages/waves/waves.component').then((m) => m.WavesComponent),
  },
  {
    path: 'waves/:id',
    canActivate: [requirePermission('wave.view')],
    loadComponent: () => import('./pages/wave-detail/wave-detail.component').then((m) => m.WaveDetailComponent),
  },
  {
    path: 'picking/tasks',
    canActivate: [requirePermission('picking.view')],
    loadComponent: () =>
      import('./pages/picking-tasks/picking-tasks.component').then((m) => m.PickingTasksComponent),
  },
  {
    path: 'packing',
    canActivate: [requirePermission('packing.view')],
    loadComponent: () => import('./pages/packing/packing.component').then((m) => m.PackingComponent),
  },
  {
    path: 'shipping',
    canActivate: [requirePermission('shipping.view')],
    loadComponent: () => import('./pages/shipping/shipping.component').then((m) => m.ShippingComponent),
  },
  {
    path: 'shipping/:id',
    canActivate: [requirePermission('shipping.view')],
    loadComponent: () =>
      import('./pages/shipping-detail/shipping-detail.component').then((m) => m.ShippingDetailComponent),
  },
  {
    path: 'cycle-counts',
    canActivate: [requirePermission('cycleCount.view')],
    loadComponent: () => import('./pages/cycle-counts/cycle-counts.component').then((m) => m.CycleCountsComponent),
  },
  {
    path: 'exceptions',
    canActivate: [requirePermission('exception.view')],
    loadComponent: () => import('./pages/exceptions/exceptions.component').then((m) => m.ExceptionsComponent),
  },
  {
    path: 'traceability',
    canActivate: [requirePermission('traceability.view')],
    loadComponent: () => import('./pages/traceability/traceability.component').then((m) => m.TraceabilityComponent),
  },
  {
    path: 'control-tower',
    canActivate: [requirePermission('controlTower.view')],
    loadComponent: () =>
      import('./pages/control-tower/control-tower.component').then((m) => m.ControlTowerComponent),
  },
  {
    path: 'audit-log',
    canActivate: [requirePermission('audit.view')],
    loadComponent: () => import('./pages/audit-log/audit-log.component').then((m) => m.AuditLogComponent),
  },
  {
    path: 'settings',
    canActivate: [requirePermission('settings.view')],
    loadComponent: () => import('./pages/settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    // Reachable without a permission — it is the denial screen itself.
    path: 'unauthorized',
    loadComponent: () =>
      import('./pages/unauthorized/unauthorized.component').then((m) => m.UnauthorizedComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
];

export const ADVANCED_WMS_ROUTES: Routes = [
  {
    path: '',
    children: WMS_ROUTES,
  },
];
