import { Routes } from '@angular/router';

export const ADVANCED_WMS_ROUTES: Routes = [
  {
    path: 'overview',
    loadComponent: () => import('./pages/overview/overview.component').then((m) => m.OverviewComponent),
  },
  {
    path: 'warehouses',
    loadComponent: () => import('./pages/warehouses/warehouses.component').then((m) => m.WarehousesComponent),
  },
  {
    path: 'locations',
    loadComponent: () => import('./pages/locations/locations.component').then((m) => m.LocationsComponent),
  },
  {
    path: 'receiving',
    loadComponent: () => import('./pages/receiving/receiving.component').then((m) => m.ReceivingComponent),
  },
  {
    path: 'receiving/:id',
    loadComponent: () =>
      import('./pages/receiving-detail/receiving-detail.component').then((m) => m.ReceivingDetailComponent),
  },
  {
    path: 'putaway',
    loadComponent: () => import('./pages/putaway/putaway.component').then((m) => m.PutawayComponent),
  },
  {
    path: 'inventory',
    loadComponent: () => import('./pages/inventory/inventory.component').then((m) => m.InventoryComponent),
  },
  {
    path: 'inventory/:sku',
    loadComponent: () =>
      import('./pages/inventory-detail/inventory-detail.component').then((m) => m.InventoryDetailComponent),
  },
  {
    path: 'lot-serial',
    loadComponent: () => import('./pages/lot-serial/lot-serial.component').then((m) => m.LotSerialComponent),
  },
  {
    path: 'stock-movements',
    loadComponent: () =>
      import('./pages/stock-movements/stock-movements.component').then((m) => m.StockMovementsComponent),
  },
  {
    path: 'reservations',
    loadComponent: () => import('./pages/reservations/reservations.component').then((m) => m.ReservationsComponent),
  },
  {
    path: 'waves',
    loadComponent: () => import('./pages/waves/waves.component').then((m) => m.WavesComponent),
  },
  {
    path: 'waves/:id',
    loadComponent: () => import('./pages/wave-detail/wave-detail.component').then((m) => m.WaveDetailComponent),
  },
  {
    path: 'picking/tasks',
    loadComponent: () =>
      import('./pages/picking-tasks/picking-tasks.component').then((m) => m.PickingTasksComponent),
  },
  {
    path: 'packing',
    loadComponent: () => import('./pages/packing/packing.component').then((m) => m.PackingComponent),
  },
  {
    path: 'shipping',
    loadComponent: () => import('./pages/shipping/shipping.component').then((m) => m.ShippingComponent),
  },
  {
    path: 'cycle-counts',
    loadComponent: () => import('./pages/cycle-counts/cycle-counts.component').then((m) => m.CycleCountsComponent),
  },
  {
    path: 'exceptions',
    loadComponent: () => import('./pages/exceptions/exceptions.component').then((m) => m.ExceptionsComponent),
  },
  {
    path: 'traceability',
    loadComponent: () => import('./pages/traceability/traceability.component').then((m) => m.TraceabilityComponent),
  },
  {
    path: 'control-tower',
    loadComponent: () =>
      import('./pages/control-tower/control-tower.component').then((m) => m.ControlTowerComponent),
  },
  {
    path: 'audit-log',
    loadComponent: () => import('./pages/audit-log/audit-log.component').then((m) => m.AuditLogComponent),
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
];
