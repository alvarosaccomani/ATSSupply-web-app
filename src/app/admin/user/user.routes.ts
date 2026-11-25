import { Routes } from '@angular/router';
import { UserLayoutComponent } from './user-layout/user-layout.component';

export const USER_ROUTES: Routes = [
  {
    path: '',
    component: UserLayoutComponent,
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'new-order',
        loadComponent: () => import('./new-order/new-order.component').then((m) => m.NewOrderComponent)
      },
      {
        path: 'delivery',
        loadComponent: () => import('./delivery/delivery.component').then((m) => m.DeliveryComponent)
      },
      {
        path: 'orders',
        loadComponent: () => import('./orders/orders').then((m) => m.Orders)
      },
      {
        path: 'production',
        loadComponent: () => import('./production/production.component').then((m) => m.ProductionComponent)
      },
      {
        path: 'customers',
        loadComponent: () => import('./customers/customers.component').then((m) => m.CustomersComponent)
      },
      {
        path: 'products',
        loadComponent: () => import('./products/products').then((m) => m.Products)
      },
      {
        path: 'price-tiers',
        loadComponent: () => import('./price-tiers/price-tiers').then((m) => m.PriceTiers)
      },
      {
        path: 'machines',
        loadComponent: () => import('./machines/machines').then((m) => m.Machines)
      },
      {
        path: 'stock-movements',
        loadComponent: () => import('./stock-movements/stock-movements').then((m) => m.StockMovements)
      },
      {
        path: 'team',
        loadComponent: () => import('./team/team').then((m) => m.Team)
      },
      {
        path: 'profile',
        loadComponent: () => import('./profile/profile').then((m) => m.Profile)
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  }
];
