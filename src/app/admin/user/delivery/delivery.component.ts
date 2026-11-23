import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '@services/orders';
import { ProductService } from '@services/products';
import { CompanyContextService } from '@services/company-context';
import { OrderInterface, OrderStatus } from '@interfaces/order';

export type DeliveryStatus = 'PENDIENTE DE ENTREGA' | 'PAGADO' | 'ENTREGADO DEBE' | 'CUENTA CORRIENTE';

export interface DeliveryOrderItem {
  id: string;
  customerName: string;
  address: string;
  phone?: string;
  detailSummary: string;
  notes?: string;
  total: number;
  status: DeliveryStatus;
  items: { productId: string; qty: number }[];
}

export interface TruckLoadItem {
  productId: string;
  productName: string;
  totalBags: number;
}

@Component({
  selector: 'app-delivery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './delivery.component.html',
  styleUrl: './delivery.component.scss'
})
export class DeliveryComponent implements OnInit {
  private readonly _orderService = inject(OrderService);
  private readonly _productService = inject(ProductService);
  private readonly _companyContext = inject(CompanyContextService);

  // Estados de carga y feedback
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  // Catálogo de productos para consolidar la estiba
  readonly products = signal<{ id: string; name: string }[]>([]);

  // Pedidos asignados a la hoja de ruta
  readonly orders = signal<DeliveryOrderItem[]>([]);

  // Computed Signals
  readonly pendingDeliveries = computed<DeliveryOrderItem[]>(() =>
    this.orders().filter((o) => o.status === 'PENDIENTE DE ENTREGA')
  );

  readonly completedDeliveries = computed<DeliveryOrderItem[]>(() =>
    this.orders().filter((o) => o.status !== 'PENDIENTE DE ENTREGA')
  );

  readonly truckLoadSummary = computed<TruckLoadItem[]>(() => {
    const pending = this.pendingDeliveries();
    const productMap: Record<string, number> = {};

    pending.forEach((o) => {
      o.items.forEach((i) => {
        productMap[i.productId] = (productMap[i.productId] || 0) + i.qty;
      });
    });

    return this.products().map((p) => ({
      productId: p.id,
      productName: p.name,
      totalBags: productMap[p.id] || 0
    }));
  });

  readonly totalTruckBags = computed<number>(() =>
    this.truckLoadSummary().reduce((acc, item) => acc + item.totalBags, 0)
  );

  readonly totalPendingAmount = computed<number>(() =>
    this.pendingDeliveries().reduce((acc, o) => acc + o.total, 0)
  );

  readonly totalCollectedAmount = computed<number>(() =>
    this.orders()
      .filter((o) => o.status === 'PAGADO')
      .reduce((acc, o) => acc + o.total, 0)
  );

  constructor() {
    // Reaccionar automáticamente ante cambios de compañía activa
    effect(() => {
      const comp = this._companyContext.activeCompany();
      if (comp?.cmp_uuid) {
        this.loadDeliveryData();
      }
    });
  }

  public ngOnInit(): void {
    this.loadDeliveryData();
  }

  public loadDeliveryData(): void {
    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;
    if (!cmp_uuid) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Cargar Productos para consolidar estiba
    this._productService.getProducts(cmp_uuid).subscribe({
      next: (res) => {
        if (res?.data && Array.isArray(res.data)) {
          this.products.set(
            res.data.map((p) => ({
              id: p.prd_uuid,
              name: p.prd_name
            }))
          );
        }
      },
      error: (err) => console.warn('Error al cargar productos para hoja de ruta:', err)
    });

    // Cargar Pedidos de la empresa
    this._orderService.getOrders(cmp_uuid).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res?.data && Array.isArray(res.data)) {
          const mappedOrders: DeliveryOrderItem[] = res.data.map((ord: OrderInterface) => {
            const rawDetails = (ord as any).details || [];
            const summaryParts = rawDetails.map((d: any) => {
              const prodName = d.product?.prd_name || 'Bolsa';
              return `${d.ordd_quantity}x ${prodName}`;
            });

            return {
              id: ord.ord_uuid,
              customerName: (ord as any).customer?.cus_name || 'Cliente sin nombre',
              address: (ord as any).customer?.cus_address || 'Sin dirección',
              phone: (ord as any).customer?.cus_phone || '',
              detailSummary: summaryParts.join(', ') || 'Sin detalle de ítems',
              notes: ord.ord_notes || '',
              total: Number(ord.ord_totalamount) || 0,
              status: this._mapToDeliveryStatus(ord.ord_status as OrderStatus),
              items: rawDetails.map((d: any) => ({
                productId: d.prd_uuid,
                qty: Number(d.ordd_quantity) || 0
              }))
            };
          });

          this.orders.set(mappedOrders);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('No se pudieron obtener los pedidos para el reparto.');
        console.warn('Error al consultar pedidos:', err);
      }
    });
  }

  public markDeliveryStatus(orderId: string, status: DeliveryStatus): void {
    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;
    if (!cmp_uuid) return;

    const previousOrder = this.orders().find((o) => o.id === orderId);
    const previousStatus = previousOrder?.status;

    // Actualización optimista en memoria
    this.orders.update((list) =>
      list.map((order) => (order.id === orderId ? { ...order, status } : order))
    );

    // Mapeo a convención del backend
    const backendStatus: OrderStatus = this._mapToBackendStatus(status);

    this._orderService
      .updateOrder(cmp_uuid, orderId, { ord_status: backendStatus })
      .subscribe({
        next: () => {
          // Confirmado por backend
        },
        error: (err) => {
          console.error('Error al persistir estado de entrega:', err);
          // Reversión optimista ante falla de red
          if (previousStatus) {
            this.orders.update((list) =>
              list.map((order) =>
                order.id === orderId ? { ...order, status: previousStatus } : order
              )
            );
          }
          const msg =
            err.error?.error ||
            err.error?.message ||
            'No se pudo guardar el cambio de estado en el servidor.';
          this.errorMessage.set(msg);
        }
      });
  }

  public openNavigationMap(address: string): void {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
  }

  public formatMoney(amount: number): string {
    return '$' + amount.toLocaleString('es-AR');
  }

  private _mapToDeliveryStatus(backendStatus: OrderStatus | string): DeliveryStatus {
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

  private _mapToBackendStatus(deliveryStatus: DeliveryStatus): OrderStatus {
    switch (deliveryStatus) {
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
