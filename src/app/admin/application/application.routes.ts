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
        path: '',
        redirectTo: 'companies',
        pathMatch: 'full'
      }
    ]
  }
];
