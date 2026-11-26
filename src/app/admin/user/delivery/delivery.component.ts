import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '@services/orders';
import { ProductService } from '@services/products';
import { CompanyContextService } from '@services/company-context';
import { OfflineSyncService } from '@services/offline-sync';
import { StockMovementsService } from '@services/stock-movements';
import { CompanySettingsService } from '@services/company-settings';
import { OrderInterface, OrderStatus } from '@interfaces/order';

export type DeliveryStatus = 'PENDIENTE DE ENTREGA' | 'PAGADO' | 'ENTREGADO DEBE' | 'CUENTA CORRIENTE';

export interface DeliveryOrderItem {
  id: string;
  customerName: string;
  address: string;
  phone?: string;
  lat?: number | null;
  lng?: number | null;
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
export class DeliveryComponent implements OnInit, OnDestroy {
  private readonly _orderService = inject(OrderService);
  private readonly _productService = inject(ProductService);
  private readonly _companyContext = inject(CompanyContextService);
  private readonly _offlineSync = inject(OfflineSyncService);
  private readonly _stockMovementsService = inject(StockMovementsService);
  private readonly _companySettingsService = inject(CompanySettingsService);

  // Estados de carga y feedback
  readonly isLoading = signal<boolean>(false);
  readonly isActionProcessing = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<{ type: 'ONLINE' | 'OFFLINE'; text: string } | null>(null);
  readonly isSuccessFading = signal<boolean>(false);

  private _successTimer: any = null;
  private _fadeTimer: any = null;

  // Catálogo de productos para consolidar la estiba
  readonly products = signal<{ id: string; name: string }[]>([]);

  // Pedidos asignados a la hoja de ruta
  readonly orders = signal<DeliveryOrderItem[]>([]);

  // Modo de descuento de stock de la empresa ('ON_DELIVERY' | 'ON_TRUCK_LOAD')
  readonly stockDeductionMode = signal<'ON_DELIVERY' | 'ON_TRUCK_LOAD'>('ON_DELIVERY');

  // Estado de despacho del camión en el día
  readonly isTruckDispatched = signal<boolean>(false);

  // Modal para liquidar regreso
  readonly isReconcileModalOpen = signal<boolean>(false);

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

  // Sobrante devuelto calculado automáticamente (Bolsas de pedidos no entregados / pendientes)
  readonly returnedSurplusSummary = computed<TruckLoadItem[]>(() => {
    return this.truckLoadSummary().filter((item) => item.totalBags > 0);
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
        this.loadStockDeductionMode(comp.cmp_uuid);
      }
    });
  }

  public ngOnInit(): void {
    this.loadDeliveryData();
    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid;
    if (cmpUuid) {
      this.loadStockDeductionMode(cmpUuid);
    }
  }

  public ngOnDestroy(): void {
    this._clearSuccessTimers();
  }

  private _clearSuccessTimers(): void {
    if (this._successTimer) {
      clearTimeout(this._successTimer);
      this._successTimer = null;
    }
    if (this._fadeTimer) {
      clearTimeout(this._fadeTimer);
      this._fadeTimer = null;
    }
  }

  public dismissSuccessMessage(): void {
    this._clearSuccessTimers();
    this.isSuccessFading.set(false);
    this.successMessage.set(null);
  }

  private _showSuccessFeedback(type: 'ONLINE' | 'OFFLINE', text: string): void {
    this._clearSuccessTimers();
    this.isSuccessFading.set(false);
    this.successMessage.set({ type, text });

    this._successTimer = setTimeout(() => {
      this.isSuccessFading.set(true);
      this._fadeTimer = setTimeout(() => {
        this.successMessage.set(null);
        this.isSuccessFading.set(false);
      }, 400);
    }, 4000);
  }

  public loadStockDeductionMode(cmp_uuid: string): void {
    this._companySettingsService.getCompanySettings(cmp_uuid, 'STOCK_DEDUCTION_MODE').subscribe({
      next: (res) => {
        const setting = (res.data || []).find((s) => s.cmps_key === 'STOCK_DEDUCTION_MODE');
        if (setting && setting.cmps_value === 'ON_TRUCK_LOAD') {
          this.stockDeductionMode.set('ON_TRUCK_LOAD');
        } else {
          this.stockDeductionMode.set('ON_DELIVERY');
        }
      },
      error: () => this.stockDeductionMode.set('ON_DELIVERY'),
    });
  }

  public loadDeliveryData(): void {
    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;
    if (!cmp_uuid) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Cargar Catálogo de Productos
    this._productService.getProducts(cmp_uuid).subscribe({
      next: (res) => {
        if (res?.data && Array.isArray(res.data)) {
          const prods = res.data
            .filter((p) => p.prd_type === 'FINISHED' && p.prd_active !== false)
            .map((p) => ({
              id: p.prd_uuid,
              name: p.prd_name
            }));
          this.products.set(prods);
        }
      },
      error: (err) => console.warn('Error al cargar productos:', err)
    });

    // Cargar Pedidos de la Empresa
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
              lat: (ord as any).customer?.cus_lat ? Number((ord as any).customer.cus_lat) : null,
              lng: (ord as any).customer?.cus_lng ? Number((ord as any).customer.cus_lng) : null,
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

  // Despachar Carga de Camioneta (Descuenta de Cámara en modo ON_TRUCK_LOAD)
  public dispatchTruck(): void {
    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;
    const items = this.truckLoadSummary()
      .filter((i) => i.totalBags > 0)
      .map((i) => ({ prd_uuid: i.productId, quantity: i.totalBags }));

    if (!cmp_uuid || items.length === 0) return;

    this.isActionProcessing.set(true);
    this._stockMovementsService.dispatchTruckLoad(cmp_uuid, items).subscribe({
      next: () => {
        this.isActionProcessing.set(false);
        this.isTruckDispatched.set(true);
        this._showSuccessFeedback('ONLINE', '¡Camioneta despachada! El stock de estiba ha sido descontado de la cámara.');
      },
      error: (err) => {
        this.isActionProcessing.set(false);
        this.errorMessage.set(err?.error?.message || 'Error al despachar y descontar carga de camioneta.');
      }
    });
  }

  // Abrir Modal de Cierre y Liquidación de Reparto
  public openReconcileModal(): void {
    this.isReconcileModalOpen.set(true);
  }

  public closeReconcileModal(): void {
    this.isReconcileModalOpen.set(false);
  }

  // Reconciliar y Reingresar Mercadería Sobrante al Regreso
  public confirmReconcileReturn(): void {
    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;
    const items = this.returnedSurplusSummary().map((i) => ({
      prd_uuid: i.productId,
      quantity: i.totalBags
    }));

    if (!cmp_uuid) return;

    if (items.length === 0) {
      this.closeReconcileModal();
      this.isTruckDispatched.set(false);
      this._showSuccessFeedback('ONLINE', 'Reparto finalizado. No hubo sobrante para reingresar.');
      return;
    }

    this.isActionProcessing.set(true);
    this._stockMovementsService.reconcileTruckReturn(cmp_uuid, items).subscribe({
      next: () => {
        this.isActionProcessing.set(false);
        this.isTruckDispatched.set(false);
        this.closeReconcileModal();
        this._showSuccessFeedback('ONLINE', '¡Reparto liquidado! El sobrante devuelto ha sido reingresado a la cámara.');
        this.loadDeliveryData();
      },
      error: (err) => {
        this.isActionProcessing.set(false);
        this.errorMessage.set(err?.error?.message || 'Error al reingresar sobrante a la cámara.');
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

    if (!this._offlineSync.isOnline()) {
      this._offlineSync.enqueueOrderStatusUpdate(cmp_uuid, orderId, backendStatus);
      this._showSuccessFeedback(
        'OFFLINE',
        `Entrega marcada como "${status}" (Modo Offline). Se subirá al servidor al recuperar la señal.`
      );
      return;
    }

    this._orderService.updateOrder(cmp_uuid, orderId, { ord_status: backendStatus }).subscribe({
      next: () => {
        this._showSuccessFeedback('ONLINE', `Entrega registrada exitosamente como "${status}".`);
      },
      error: (err) => {
        console.error('Error al actualizar estado del pedido:', err);
        this.orders.update((list) =>
          list.map((order) => (order.id === orderId ? { ...order, status: previousStatus! } : order))
        );
        this.errorMessage.set('No se pudo confirmar la entrega. Se restauró el estado original.');
      }
    });
  }

  public getStatusBadgeClass(status: DeliveryStatus): string {
    switch (status) {
      case 'PAGADO':
        return 'badge-pagado';
      case 'ENTREGADO DEBE':
        return 'badge-debe';
      case 'CUENTA CORRIENTE':
        return 'badge-ctacte';
      default:
        return 'badge-pendiente';
    }
  }

  public formatMoney(amount: number): string {
    return '$' + amount.toLocaleString('es-AR');
  }

  private _mapToDeliveryStatus(backendStatus: OrderStatus): DeliveryStatus {
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

  private _mapToBackendStatus(status: DeliveryStatus): OrderStatus {
    switch (status) {
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
