import { Routes } from '@angular/router';
import { sysadminGuard } from '@guards/sysadmin.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'application',
    canActivate: [sysadminGuard],
    loadChildren: () => import('./application/application.routes').then(m => m.APPLICATION_ROUTES)
  },
  {
    path: 'user',
    loadChildren: () => import('./user/user.routes').then(m => m.USER_ROUTES)
  },
  {
    path: '',
    redirectTo: 'user',
    pathMatch: 'full'
  }
];
