import { Routes } from '@angular/router';
import { requireAuth } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [requireAuth],
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
