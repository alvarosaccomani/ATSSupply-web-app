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
        path: 'company-settings',
        loadComponent: () => import('./company-settings/company-settings').then((m) => m.CompanySettings)
      },
      {
        path: 'company-menus',
        loadComponent: () => import('./company-menus/company-menus').then((m) => m.CompanyMenus)
      },
      {
        path: 'menus',
        loadComponent: () => import('./menus/menus').then((m) => m.Menus)
      },
      {
        path: 'resource-modules',
        loadComponent: () => import('./resource-modules/resource-modules').then((m) => m.ResourceModules)
      },
      {
        path: '',
        redirectTo: 'companies',
        pathMatch: 'full'
      }
    ]
  }
];
