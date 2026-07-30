import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shared/components/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'wms/overview' },
      {
        path: 'wms',
        loadChildren: () =>
          import('./features/advanced-wms/advanced-wms.routes').then((m) => m.ADVANCED_WMS_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: 'wms/overview' },
];
