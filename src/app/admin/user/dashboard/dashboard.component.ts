import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompanyContextService } from '@services/company-context';
import { ProductService } from '@services/products';
import { OrderService } from '@services/orders';
import { OrderInterface, OrderStatus as BackendOrderStatus } from '@interfaces/order';

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
export class DashboardComponent implements OnInit {
  private readonly _companyContext = inject(CompanyContextService);
  private readonly _productService = inject(ProductService);
  private readonly _orderService = inject(OrderService);

  readonly showProduction = this._companyContext.canProduce;
  readonly showSales = this._companyContext.hasSales;

  // Estados de carga y feedback
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  // Estado de Stock en Cámara
  readonly stockItems = signal<DashboardStockItem[]>([]);

  // Pedidos del Día
  readonly orders = signal<DashboardOrderItem[]>([]);

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

  constructor() {
    // Reaccionar automáticamente ante cambios de compañía activa
    effect(() => {
      const comp = this._companyContext.activeCompany();
      if (comp?.cmp_uuid) {
        this.loadDashboardData();
      }
    });
  }

  public ngOnInit(): void {
    this.loadDashboardData();
  }

  public loadDashboardData(): void {
    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;
    if (!cmp_uuid) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Cargar Stock de Productos Terminados en Cámara
    this._productService.getProducts(cmp_uuid).subscribe({
      next: (res) => {
        if (res?.data && Array.isArray(res.data)) {
          const finishedProducts = res.data
            .filter((p) => p.prd_type === 'FINISHED')
            .map((p) => ({
              id: p.prd_uuid,
              name: p.prd_name,
              stock: Number(p.prd_currentstock) || 0,
              minStock: Number(p.prd_minstockalert) || 0
            }));
          this.stockItems.set(finishedProducts);
        }
      },
      error: (err) => console.warn('Error al cargar stock para dashboard:', err)
    });

    // Cargar Pedidos del Día
    this._orderService.getOrders(cmp_uuid).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res?.data && Array.isArray(res.data)) {
          const mappedOrders: DashboardOrderItem[] = res.data.map((ord: OrderInterface) => {
            const rawDetails = (ord as any).details || [];
            const totalUnits = rawDetails.reduce(
              (acc: number, d: any) => acc + (Number(d.ordd_quantity) || 0),
              0
            );
            const summaryParts = rawDetails.map(
              (d: any) => `${d.ordd_quantity}x ${d.product?.prd_name || 'Bolsa'}`
            );

            return {
              id: ord.ord_uuid,
              customerName: (ord as any).customer?.cus_name || 'Cliente sin nombre',
              customerTier: 'C',
              address: (ord as any).customer?.cus_address || 'Sin dirección',
              itemsSummary: summaryParts.join(', ') || 'Sin detalle',
              total: Number(ord.ord_totalamount) || 0,
              totalUnits: totalUnits || 0,
              status: this._mapToDashboardStatus(ord.ord_status as BackendOrderStatus)
            };
          });

          this.orders.set(mappedOrders);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('No se pudieron consultar los pedidos de la jornada.');
        console.warn('Error al cargar pedidos para dashboard:', err);
      }
    });
  }

  public changeOrderStatus(orderId: string, newStatus: OrderStatus): void {
    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;
    if (!cmp_uuid) return;

    const previousOrder = this.orders().find((o) => o.id === orderId);
    const previousStatus = previousOrder?.status;

    // Actualización optimista en memoria
    this.orders.update((list) =>
      list.map((order) =>
        order.id === orderId ? { ...order, status: newStatus } : order
      )
    );

    // Mapeo a convención del backend
    const backendStatus: BackendOrderStatus = this._mapToBackendStatus(newStatus);

    this._orderService
      .updateOrder(cmp_uuid, orderId, { ord_status: backendStatus })
      .subscribe({
        next: () => {
          // Confirmado por backend
        },
        error: (err) => {
          console.error('Error al actualizar estado de pedido:', err);
          if (previousStatus) {
            this.orders.update((list) =>
              list.map((order) =>
                order.id === orderId ? { ...order, status: previousStatus } : order
              )
            );
          }
          this.errorMessage.set('No se pudo guardar el cambio de estado del pedido.');
        }
      });
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

  private _mapToDashboardStatus(backendStatus: BackendOrderStatus | string): OrderStatus {
    switch (backendStatus) {
      case 'PAGADO':
        return 'PAGADO';
      case 'ENTREGADO_DEBE':
        return 'ENTREGADO DEBE';
      case 'CUENTA_CORRIENTE':
        return 'CUENTA CORRIENTE';
      default:
        return 'PENDIENTE DE ENTREGA';
    }
  }

  private _mapToBackendStatus(dashboardStatus: OrderStatus): BackendOrderStatus {
    switch (dashboardStatus) {
      case 'PAGADO':
        return 'PAGADO';
      case 'ENTREGADO DEBE':
        return 'ENTREGADO_DEBE';
      case 'CUENTA CORRIENTE':
        return 'CUENTA_CORRIENTE';
      default:
        return 'PENDIENTE_DE_ENTREGA';
    }
  }
}
