import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { CompanyContextService } from '@services/company-context';
import { ProductService } from '@services/products';
import { OrderService } from '@services/orders';
import { ProductionOrderService } from '@services/production-orders';
import { MachineService } from '@services/machines';
import { OrderInterface, OrderStatus as BackendOrderStatus } from '@interfaces/order';
import { ProductionOrderInterface } from '@interfaces/production-order';
import { MachineInterface } from '@interfaces/machine';
import { ProductInterface } from '@interfaces/product';

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
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly _companyContext = inject(CompanyContextService);
  private readonly _productService = inject(ProductService);
  private readonly _orderService = inject(OrderService);
  private readonly _productionOrderService = inject(ProductionOrderService);
  private readonly _machineService = inject(MachineService);

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
  readonly productionLogs = signal<DashboardProductionLog[]>([]);

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
            .filter((p) => p.prd_type === 'FINISHED' && p.prd_active !== false)
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

    // Cargar Lotes de Producción si la empresa tiene producción activa
    if (this.showProduction()) {
      forkJoin({
        orders: this._productionOrderService.getProductionOrders(cmp_uuid),
        machines: this._machineService.getMachines(cmp_uuid),
        products: this._productService.getProducts(cmp_uuid)
      }).subscribe({
        next: ({ orders, machines, products }) => {
          const rawOrders: ProductionOrderInterface[] =
            (orders as any)?.data || (Array.isArray(orders) ? orders : []);
          const rawMachines: MachineInterface[] =
            (machines as any)?.data || (Array.isArray(machines) ? machines : []);
          const rawProducts: ProductInterface[] =
            (products as any)?.data || (Array.isArray(products) ? products : []);

          const sortedOrders = [...rawOrders].sort((a, b) => {
            const dateA = new Date(a.prdord_productiondate || a.prdord_createdat || 0).getTime();
            const dateB = new Date(b.prdord_productiondate || b.prdord_createdat || 0).getTime();
            return dateB - dateA;
          });

          const logs: DashboardProductionLog[] = sortedOrders.slice(0, 5).map((ord) => {
            const pDate = ord.prdord_productiondate
              ? new Date(ord.prdord_productiondate)
              : ord.prdord_createdat
              ? new Date(ord.prdord_createdat)
              : new Date();
            const hours = String(pDate.getHours()).padStart(2, '0');
            const minutes = String(pDate.getMinutes()).padStart(2, '0');
            const time = `${hours}:${minutes}`;

            const machineName =
              rawMachines.find((m) => m.mch_uuid === ord.mch_uuid)?.mch_name || 'Línea de Envasado';
            const productName =
              rawProducts.find((p) => p.prd_uuid === ord.prd_uuid)?.prd_name || 'Bolsa de Hielo';

            return {
              id: ord.prdord_uuid,
              machine: machineName,
              productName: productName,
              qty: Number(ord.prdord_producedqty) || 0,
              waste: Number(ord.prdord_wasteqty) || 0,
              time
            };
          });

          this.productionLogs.set(logs);
        },
        error: (err) => console.warn('Error al cargar lotes de producción para dashboard:', err)
      });
    }
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
}
