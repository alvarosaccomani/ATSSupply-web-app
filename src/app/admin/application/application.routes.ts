import { Routes } from '@angular/router';
import { ApplicationLayoutComponent } from './application-layout/application-layout.component';

export const APPLICATION_ROUTES: Routes = [
  {
    path: '',
    component: ApplicationLayoutComponent,
    children: [
      {
        path: 'companies',
        loadComponent: () => import('./companies/companies').then((m) => m.Companies)
      },
      {
        path: 'company-items',
        loadComponent: () => import('./company-items/company-items').then((m) => m.CompanyItems)
      },
      {
        path: 'roles-permissions',
        loadComponent: () => import('./roles-permissions/roles-permissions').then((m) => m.RolesPermissions)
      },
      {
        path: '',
        redirectTo: 'companies',
        pathMatch: 'full'
      }
    ]
  }
];
