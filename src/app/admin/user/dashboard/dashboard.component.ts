import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompanyContextService } from '@services/company-context';

export interface DashboardStockItem {
  id: string;
  name: string;
  stock: number;
  minStock: number;
}

export type OrderStatus = 'PENDIENTE DE ENTREGA' | 'ENTREGADO DEBE' | 'PAGADO' | 'CUENTA CORRIENTE';

export interface DashboardOrderItem {
  id: string;
  customerName: string;
  customerTier: 'A' | 'B' | 'C';
  address: string;
  itemsSummary: string;
  total: number;
  totalUnits: number;
  status: OrderStatus;
}

export interface DashboardProductionLog {
  id: string;
  machine: string;
  productName: string;
  qty: number;
  waste: number;
  time: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private readonly _companyContext = inject(CompanyContextService);

  readonly showProduction = this._companyContext.canProduce;
  readonly showSales = this._companyContext.hasSales;

  // Estado de Stock en Cámara
  readonly stockItems = signal<DashboardStockItem[]>([
    { id: 'prd-2', name: 'Bolsa 2 kg', stock: 180, minStock: 50 },
    { id: 'prd-3', name: 'Bolsa 3 kg', stock: 240, minStock: 60 },
    { id: 'prd-5', name: 'Bolsa 5 kg', stock: 95, minStock: 40 },
    { id: 'prd-15', name: 'Bolsa 15 kg', stock: 35, minStock: 40 }
  ]);

  // Pedidos del Día
  readonly orders = signal<DashboardOrderItem[]>([
    {
      id: 'ord-101',
      customerName: 'DISTRIBUIDORA ERRAMUSPE',
      customerTier: 'A',
      address: 'Ruta 7 Km 68',
      itemsSummary: '15x Bolsa 3 kg',
      total: 45000,
      totalUnits: 15,
      status: 'PENDIENTE DE ENTREGA'
    },
    {
      id: 'ord-102',
      customerName: 'KITA',
      customerTier: 'A',
      address: 'Av. Constitución 1240',
      itemsSummary: '100x Bolsa 15 kg',
      total: 1500000,
      totalUnits: 100,
      status: 'PENDIENTE DE ENTREGA'
    },
    {
      id: 'ord-103',
      customerName: 'PARRILLA KAPI',
      customerTier: 'B',
      address: 'Humberto 2130',
      itemsSummary: '10x Bolsa 5 kg',
      total: 55000,
      totalUnits: 10,
      status: 'PAGADO'
    }
  ]);

  // Lotes recientes de Producción
  readonly productionLogs = signal<DashboardProductionLog[]>([
    {
      id: 'lot-1',
      machine: 'Fabricadora Rolito 1',
      productName: 'Bolsa 3 kg',
      qty: 150,
      waste: 3,
      time: '08:30'
    },
    {
      id: 'lot-2',
      machine: 'Fabricadora Rolito 2',
      productName: 'Bolsa 15 kg',
      qty: 80,
      waste: 1,
      time: '10:15'
    }
  ]);

  // KPIs Financieros y de Despacho Reactivos
  readonly kpiTotalBags = computed<number>(() =>
    this.orders().reduce((acc, order) => acc + order.totalUnits, 0)
  );

  readonly kpiPaidAmount = computed<number>(() =>
    this.orders()
      .filter((order) => order.status === 'PAGADO')
      .reduce((acc, order) => acc + order.total, 0)
  );

  readonly kpiPendingAmount = computed<number>(() =>
    this.orders()
      .filter((order) => order.status !== 'PAGADO')
      .reduce((acc, order) => acc + order.total, 0)
  );

  public changeOrderStatus(orderId: string, newStatus: OrderStatus): void {
    this.orders.update((list) =>
      list.map((order) =>
        order.id === orderId ? { ...order, status: newStatus } : order
      )
    );
  }

  public getStatusBadgeClass(status: OrderStatus): string {
    const badgeMap: Record<OrderStatus, string> = {
      'PENDIENTE DE ENTREGA': 'badge-pendiente',
      'ENTREGADO DEBE': 'badge-debe',
      'PAGADO': 'badge-pagado',
      'CUENTA CORRIENTE': 'badge-ctacte'
    };
    return badgeMap[status] ?? 'badge-pendiente';
  }

  public formatMoney(amount: number): string {
    return '$' + amount.toLocaleString('es-AR');
  }
}
