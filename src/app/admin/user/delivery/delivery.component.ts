import { Component, OnDestroy, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '@services/orders';
import { ProductService } from '@services/products';
import { CompanyContextService } from '@services/company-context';
import { OfflineSyncService } from '@services/offline-sync';
import { StockMovementsService } from '@services/stock-movements';
import { CompanySettingsService } from '@services/company-settings';
import { UserRolesCompanyService } from '@services/user-roles-company';
import { AuthService } from '@services/auth';
import { MapComponent, MapMarker } from '@components/map/map';
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
  hasCredit: boolean;
  driverUuid?: string | null;
  driverName?: string | null;
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
  imports: [CommonModule, MapComponent],
  templateUrl: './delivery.component.html',
  styleUrl: './delivery.component.scss'
})
export class DeliveryComponent implements OnInit, OnDestroy {
  @ViewChild(MapComponent) mapComponent?: MapComponent;

  private readonly _orderService = inject(OrderService);
  private readonly _productService = inject(ProductService);
  private readonly _companyContext = inject(CompanyContextService);
  private readonly _offlineSync = inject(OfflineSyncService);
  private readonly _stockMovementsService = inject(StockMovementsService);
  private readonly _companySettingsService = inject(CompanySettingsService);
  private readonly _userRolesCompanyService = inject(UserRolesCompanyService);
  private readonly _authService = inject(AuthService);

  // Modo de visualización: 'LIST' (solo lista), 'MAP' (solo mapa), 'SPLIT' (lista y mapa en pantalla)
  readonly activeDeliveryView = signal<'LIST' | 'MAP' | 'SPLIT'>('SPLIT');

  // Parada seleccionada/enfocada
  readonly selectedOrderForMap = signal<string | null>(null);

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

  // Choferes registrados para el reparto
  readonly drivers = signal<{ id: string; name: string }[]>([]);

  // Chofer seleccionado en el filtro ('ALL' | 'UNASSIGNED' | uuid)
  readonly selectedDriverId = signal<string | null>(null);

  // Modo de descuento de stock de la empresa ('ON_DELIVERY' | 'ON_TRUCK_LOAD')
  readonly stockDeductionMode = signal<'ON_DELIVERY' | 'ON_TRUCK_LOAD'>('ON_DELIVERY');

  // Estado de despacho del camión en el día
  readonly isTruckDispatched = signal<boolean>(false);

  // Modal para liquidar regreso
  readonly isReconcileModalOpen = signal<boolean>(false);

  // Roles del usuario activo
  readonly isDriver = computed<boolean>(() => this._companyContext.isDriver());
  readonly isOwner = computed<boolean>(() => this._companyContext.isOwner());

  // Nombre del chofer logueado
  readonly currentDriverName = computed<string>(() => {
    const user = this._authService.currentUser();
    if (!user) return 'Chofer';
    return `${user.usr_name} ${user.usr_surname || ''}`.trim();
  });

  // Pedidos visibles según el chofer seleccionado
  readonly visibleOrders = computed<DeliveryOrderItem[]>(() => {
    const list = this.orders();
    const selDriver = this.selectedDriverId();
    const totalDrivers = this.drivers().length;

    // Si el usuario logueado es un chofer, solo ve sus pedidos asignados
    if (this.isDriver()) {
      const myId = this._authService.currentUser()?.usr_uuid;
      if (!myId) return list;
      return list.filter((o) => o.driverUuid === myId);
    }

    // Administrador / Dueño: Si no hay selección o es 'ALL'
    if (!selDriver || selDriver === 'ALL') {
      return list;
    }

    // Pedidos sin chofer asignado
    if (selDriver === 'UNASSIGNED') {
      return list.filter((o) => !o.driverUuid);
    }

    // Si la empresa tiene exactamente 1 chofer cargado y está autoseleccionado:
    // mostramos los asignados a él más los pedidos no asignados aún
    if (totalDrivers === 1 && selDriver === this.drivers()[0]?.id) {
      return list.filter((o) => o.driverUuid === selDriver || !o.driverUuid);
    }

    // Si hay múltiples choferes: filtrar estrictamente por el chofer elegido
    return list.filter((o) => o.driverUuid === selDriver);
  });

  // Computed Signals
  readonly pendingDeliveries = computed<DeliveryOrderItem[]>(() =>
    this.visibleOrders().filter((o) => o.status === 'PENDIENTE DE ENTREGA')
  );

  readonly completedDeliveries = computed<DeliveryOrderItem[]>(() =>
    this.visibleOrders().filter((o) => o.status !== 'PENDIENTE DE ENTREGA')
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
    this.visibleOrders()
      .filter((o) => o.status === 'PAGADO')
      .reduce((acc, o) => acc + o.total, 0)
  );

  // Pedidos pendientes que no tienen coordenadas GPS fijadas
  readonly pendingWithoutGps = computed<DeliveryOrderItem[]>(() =>
    this.pendingDeliveries().filter((o) => o.lat == null || o.lng == null)
  );

  // Marcadores interactivos para el mapa de ruta
  readonly routeMarkers = computed<MapMarker[]>(() => {
    const markers: MapMarker[] = [];
    const selectedId = this.selectedOrderForMap();

    // 1. Entregas pendientes (numeradas: 1, 2, 3...)
    this.pendingDeliveries().forEach((o, index) => {
      if (o.lat != null && o.lng != null) {
        const isSelected = selectedId === o.id;
        markers.push({
          id: o.id,
          lng: o.lng,
          lat: o.lat,
          title: o.customerName,
          label: String(index + 1),
          color: isSelected ? '#ef4444' : '#0284c7',
          popupHtml: `
            <div class="p-1">
              <span class="badge bg-primary mb-1">Parada #${index + 1}</span>
              <strong class="d-block text-dark">${o.customerName}</strong>
              <small class="text-muted d-block mb-1">${o.address}</small>
              <div class="fw-bold text-success mb-1">${this.formatMoney(o.total)}</div>
              <div class="small text-secondary fst-italic">${o.detailSummary}</div>
            </div>
          `
        });
      }
    });

    // 2. Entregas completadas hoy (tilde verde)
    this.completedDeliveries().forEach((o) => {
      if (o.lat != null && o.lng != null) {
        markers.push({
          id: o.id,
          lng: o.lng,
          lat: o.lat,
          title: o.customerName,
          label: '✓',
          color: '#10b981',
          popupHtml: `
            <div class="p-1">
              <span class="badge bg-success mb-1">Entregado</span>
              <strong class="d-block text-dark">${o.customerName}</strong>
              <small class="text-muted d-block mb-1">${o.address}</small>
              <div class="fw-bold text-dark">${this.formatMoney(o.total)}</div>
            </div>
          `
        });
      }
    });

    return markers;
  });

  // Trazado de línea GeoJSON conectando las paradas pendientes en orden
  readonly routeCoordinates = computed<[number, number][]>(() => {
    return this.pendingDeliveries()
      .filter((o) => o.lng != null && o.lat != null)
      .map((o) => [o.lng!, o.lat!] as [number, number]);
  });

  // Centro dinámico del mapa
  readonly deliveryMapCenter = computed<[number, number]>(() => {
    const selectedId = this.selectedOrderForMap();
    if (selectedId) {
      const order = this.orders().find((o) => o.id === selectedId);
      if (order?.lng != null && order?.lat != null) {
        return [order.lng, order.lat];
      }
    }

    const firstWithGps = this.visibleOrders().find((o) => o.lng != null && o.lat != null);
    if (firstWithGps && firstWithGps.lng && firstWithGps.lat) {
      return [firstWithGps.lng, firstWithGps.lat];
    }

    return [-64.1888, -31.4201];
  });

  constructor() {
    // Reaccionar automáticamente ante cambios de compañía activa
    effect(() => {
      const comp = this._companyContext.activeCompany();
      if (comp?.cmp_uuid) {
        this.loadDeliveryData();
        this.loadStockDeductionMode(comp.cmp_uuid);
        this.loadDrivers(comp.cmp_uuid);
      }
    });
  }

  public ngOnInit(): void {
    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid;
    if (cmpUuid) {
      this.loadStockDeductionMode(cmpUuid);
      this.loadDrivers(cmpUuid);
    }
    this.loadDeliveryData();
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

            const driverUser = (ord as any).driver;
            const driverName = driverUser
              ? `${driverUser.usr_name} ${driverUser.usr_surname || ''}`.trim()
              : null;

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
              hasCredit: Boolean((ord as any).customer?.cus_hascredit),
              driverUuid: ord.usr_uuid_driver || null,
              driverName,
              items: rawDetails.map((d: any) => ({
                productId: d.prd_uuid,
                qty: Number(d.ordd_quantity) || 0
              }))
            };
          });

          this.orders.set(mappedOrders);
          this.loadDrivers(cmp_uuid);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('No se pudieron obtener los pedidos para el reparto.');
        console.warn('Error al consultar pedidos:', err);
      }
    });
  }

  /**
   * Carga los choferes de la empresa y ejecuta la auto-selección inteligente.
   */
  public loadDrivers(cmp_uuid: string): void {
    this._userRolesCompanyService.getUserRolesCompany(cmp_uuid).subscribe({
      next: (res) => {
        const driverMap = new Map<string, string>();

        if (res?.data && Array.isArray(res.data)) {
          res.data.forEach((urc: any) => {
            const roleName = (urc.rol_name || urc.rol?.rol_name || '').toLowerCase();
            const isDriverRole =
              roleName.includes('chofer') ||
              roleName.includes('repartidor') ||
              roleName.includes('driver') ||
              roleName.includes('logistica') ||
              roleName.includes('entrega');

            if (isDriverRole && urc.usr_uuid) {
              const name = urc.usr
                ? `${urc.usr.usr_name} ${urc.usr.usr_surname || ''}`.trim()
                : urc.usr_name || 'Chofer';
              driverMap.set(urc.usr_uuid, name);
            }
          });
        }

        // Agregar también choferes asignados en los pedidos cargados
        this.orders().forEach((o) => {
          if (o.driverUuid && !driverMap.has(o.driverUuid)) {
            driverMap.set(o.driverUuid, o.driverName || 'Chofer');
          }
        });

        const list = Array.from(driverMap.entries()).map(([id, name]) => ({ id, name }));
        this.drivers.set(list);

        // Auto-selección según rol y cantidad de choferes
        if (this.isDriver()) {
          const myId = this._authService.currentUser()?.usr_uuid || null;
          this.selectedDriverId.set(myId);
          this.checkDriverDispatchStatus(cmp_uuid, myId);
        } else {
          // Si es Dueño o Administrador
          if (list.length === 1) {
            // REGLA: Si tiene un solo chofer cargado, se autoselecciona el único chofer
            this.selectedDriverId.set(list[0].id);
            this.checkDriverDispatchStatus(cmp_uuid, list[0].id);
          } else if (list.length > 1) {
            const current = this.selectedDriverId();
            const isValid =
              current &&
              (current === 'ALL' || current === 'UNASSIGNED' || list.some((d) => d.id === current));
            if (!isValid) {
              this.selectedDriverId.set(list[0].id);
              this.checkDriverDispatchStatus(cmp_uuid, list[0].id);
            } else {
              this.checkDriverDispatchStatus(cmp_uuid, current);
            }
          } else {
            this.selectedDriverId.set('ALL');
            this.checkDriverDispatchStatus(cmp_uuid, undefined);
          }
        }
      },
      error: (err) => {
        console.warn('Error al consultar choferes de la empresa:', err);
        this.checkDriverDispatchStatus(cmp_uuid, undefined);
      }
    });
  }

  /**
   * Consulta el estado de despacho de camión para un chofer específico o general.
   */
  public checkDriverDispatchStatus(cmp_uuid: string, driverId?: string | null): void {
    const effectiveDriver =
      driverId && driverId !== 'ALL' && driverId !== 'UNASSIGNED' ? driverId : undefined;

    this._stockMovementsService.getDispatchStatus(cmp_uuid, effectiveDriver).subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          this.isTruckDispatched.set(res.data.isDispatched);
          const key = `ats_truck_dispatched_${cmp_uuid}_${effectiveDriver || 'default'}`;
          if (res.data.isDispatched) {
            localStorage.setItem(key, 'true');
          } else {
            localStorage.removeItem(key);
          }
        }
      },
      error: () => {
        const key = `ats_truck_dispatched_${cmp_uuid}_${effectiveDriver || 'default'}`;
        const local = localStorage.getItem(key);
        this.isTruckDispatched.set(local === 'true');
      }
    });
  }

  public onDriverSelectChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    this.selectedDriverId.set(value);
    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid;
    if (cmpUuid) {
      this.checkDriverDispatchStatus(cmpUuid, value);
    }
  }

  public onOrderDriverChange(orderId: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const driverId = select.value ? select.value : null;
    this.assignDriverToOrder(orderId, driverId);
  }

  public assignDriverToOrder(orderId: string, driverId: string | null): void {
    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;
    if (!cmp_uuid) return;

    this._orderService.assignDriverToOrders(cmp_uuid, [orderId], driverId).subscribe({
      next: () => {
        const driverName = this.drivers().find((d) => d.id === driverId)?.name || null;
        this.orders.update((list) =>
          list.map((o) => (o.id === orderId ? { ...o, driverUuid: driverId, driverName } : o))
        );
        this._showSuccessFeedback('ONLINE', 'Chofer asignado al pedido con éxito.');
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error al asignar chofer al pedido.');
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

    const selDriver = this.selectedDriverId();
    const effectiveDriver =
      selDriver && selDriver !== 'ALL' && selDriver !== 'UNASSIGNED' ? selDriver : undefined;

    this.isActionProcessing.set(true);
    this._stockMovementsService.dispatchTruckLoad(cmp_uuid, items, undefined, effectiveDriver).subscribe({
      next: () => {
        this.isActionProcessing.set(false);
        this.isTruckDispatched.set(true);
        const key = `ats_truck_dispatched_${cmp_uuid}_${effectiveDriver || 'default'}`;
        localStorage.setItem(key, 'true');
        this._showSuccessFeedback(
          'ONLINE',
          '¡Camioneta despachada! El stock de estiba ha sido descontado de la cámara.'
        );
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

    const selDriver = this.selectedDriverId();
    const effectiveDriver =
      selDriver && selDriver !== 'ALL' && selDriver !== 'UNASSIGNED' ? selDriver : undefined;

    this.isActionProcessing.set(true);
    this._stockMovementsService.reconcileTruckReturn(cmp_uuid, items, undefined, effectiveDriver).subscribe({
      next: () => {
        this.isActionProcessing.set(false);
        this.isTruckDispatched.set(false);
        const key = `ats_truck_dispatched_${cmp_uuid}_${effectiveDriver || 'default'}`;
        localStorage.removeItem(key);
        this.closeReconcileModal();
        const msg =
          items.length > 0
            ? '¡Reparto liquidado! El sobrante devuelto ha sido reingresado a la cámara.'
            : '¡Reparto finalizado con éxito! 100% de los pedidos entregados.';
        this._showSuccessFeedback('ONLINE', msg);
        this.loadDeliveryData();
      },
      error: (err) => {
        this.isActionProcessing.set(false);
        this.errorMessage.set(err?.error?.message || 'Error al cerrar el reparto.');
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

  public setDeliveryView(view: 'LIST' | 'MAP' | 'SPLIT'): void {
    this.activeDeliveryView.set(view);
    setTimeout(() => this.mapComponent?.resize(), 100);
  }

  public focusOrderOnMap(order: DeliveryOrderItem): void {
    if (order.lng == null || order.lat == null) return;
    this.selectedOrderForMap.set(order.id);
    if (this.activeDeliveryView() === 'LIST') {
      this.activeDeliveryView.set('SPLIT');
    }
    setTimeout(() => {
      this.mapComponent?.resize();
      this.mapComponent?.map?.flyTo({
        center: [order.lng!, order.lat!],
        zoom: 15,
        essential: true
      });
    }, 150);
  }

  public onMapMarkerClick(marker: MapMarker): void {
    this.selectedOrderForMap.set(String(marker.id));
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
