import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CompanyContextService } from '@services/company-context';
import { ProductService } from '@services/products';
import { OrderService } from '@services/orders';
import { ProductionOrderService } from '@services/production-orders';
import { MachineService } from '@services/machines';
import { MenusService } from '@services/menus';
import { CompanyMenusService } from '@services/company-menus';
import { CustomerService } from '@services/customers';
import { CustomerInterface } from '@interfaces/customer';
import { MapComponent, MapMarker, HeatPoint } from '@components/map/map';
import { OrderInterface, OrderStatus as BackendOrderStatus } from '@interfaces/order';
import { ProductionOrderInterface } from '@interfaces/production-order';
import { MachineInterface } from '@interfaces/machine';
import { ProductInterface } from '@interfaces/product';
import { MenuItemTree, MenuInterface } from '@interfaces/menu';
import { CompanyMenuInterface } from '@interfaces/company-menu';

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

export interface DashboardShortcutItem {
  key: string;
  route: string;
  title: string;
  icon: string;
  order: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MapComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly _companyContext = inject(CompanyContextService);
  private readonly _productService = inject(ProductService);
  private readonly _orderService = inject(OrderService);
  private readonly _productionOrderService = inject(ProductionOrderService);
  private readonly _machineService = inject(MachineService);
  private readonly _menusService = inject(MenusService);
  private readonly _companyMenusService = inject(CompanyMenusService);
  private readonly _customerService = inject(CustomerService);

  readonly showProduction = this._companyContext.canProduce;
  readonly showSales = this._companyContext.hasSales;
  readonly role = this._companyContext.activeRole;

  // Permisos según rol operativo
  readonly showOrdersHistory = computed<boolean>(
    () => this.showSales() && (this.role() === 'OWNER' || this.role() === 'SELLER')
  );
  readonly showCustomers = computed<boolean>(
    () => this.showSales() && (this.role() === 'OWNER' || this.role() === 'SELLER')
  );
  readonly showProducts = computed<boolean>(
    () => this.role() === 'OWNER' || this.role() === 'SELLER'
  );
  readonly showPriceTiers = computed<boolean>(() => this.role() === 'OWNER');
  readonly showMachines = computed<boolean>(
    () => this.showProduction() && this.role() === 'OWNER'
  );
  readonly showStockMovements = computed<boolean>(() => this.role() === 'OWNER');
  readonly showTeam = computed<boolean>(() => this.role() === 'OWNER');

  // Estados de carga y feedback
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  // Estado de Stock en Cámara
  readonly stockItems = signal<DashboardStockItem[]>([]);

  // Pedidos del Día
  readonly orders = signal<DashboardOrderItem[]>([]);

  // Lotes recientes de Producción
  readonly productionLogs = signal<DashboardProductionLog[]>([]);

  // Inteligencia Comercial y Mapa de Calor (Owner)
  readonly rawCustomers = signal<CustomerInterface[]>([]);
  readonly rawOrders = signal<OrderInterface[]>([]);
  readonly activeCommercialMapView = signal<'HEATMAP' | 'COLD_ZONES' | 'ALL_CUSTOMERS'>('HEATMAP');

  // Centro del mapa según coordenadas de la empresa o clientes
  readonly commercialMapCenter = computed<[number, number]>(() => {
    const comp = this._companyContext.activeCompany();
    if (comp?.cmp_lng != null && comp?.cmp_lat != null) {
      return [Number(comp.cmp_lng), Number(comp.cmp_lat)];
    }
    const firstGeo = this.rawCustomers().find((c) => c.cus_lat != null && c.cus_lng != null);
    if (firstGeo?.cus_lng != null && firstGeo?.cus_lat != null) {
      return [Number(firstGeo.cus_lng), Number(firstGeo.cus_lat)];
    }
    return [-64.1888, -31.4201];
  });

  // Métricas geocomerciales
  readonly totalCustomersCount = computed<number>(() => this.rawCustomers().length);
  readonly geocodedCustomersCount = computed<number>(() =>
    this.rawCustomers().filter((c) => c.cus_lat != null && c.cus_lng != null).length
  );
  readonly coveragePercentage = computed<number>(() => {
    const total = this.totalCustomersCount();
    if (total === 0) return 0;
    return Math.round((this.geocodedCustomersCount() / total) * 100);
  });

  // Mapa de facturación acumulada por cliente
  readonly customerSalesMap = computed<Map<string, number>>(() => {
    const map = new Map<string, number>();
    const ords = this.rawOrders();
    ords.forEach((ord: any) => {
      const cId = ord.cus_uuid || ord.customer?.cus_uuid;
      if (cId) {
        const current = map.get(cId) || 0;
        const total = Number(ord.ord_totalamount) || Number(ord.ord_total) || 0;
        map.set(cId, current + total);
      }
    });
    return map;
  });

  // Puntos para la capa de calor de ventas (Heatmap)
  readonly commercialHeatPoints = computed<HeatPoint[]>(() => {
    const customers = this.rawCustomers();
    const salesMap = this.customerSalesMap();

    return customers
      .filter((c) => c.cus_lat != null && c.cus_lng != null)
      .map((c) => {
        const totalPurchased = salesMap.get(c.cus_uuid) || 0;
        return {
          lng: Number(c.cus_lng),
          lat: Number(c.cus_lat),
          weight: totalPurchased > 0 ? totalPurchased : 100,
          title: `${c.cus_name} (${this.formatMoney(totalPurchased)})`
        };
      });
  });

  // Clientes en "Zona Fría" (geolocalizados pero sin compras para mandar preventistas)
  readonly coldZoneCustomers = computed<CustomerInterface[]>(() => {
    const customers = this.rawCustomers();
    const salesMap = this.customerSalesMap();

    return customers
      .filter((c) => c.cus_lat != null && c.cus_lng != null)
      .filter((c) => (salesMap.get(c.cus_uuid) || 0) === 0);
  });

  // Marcadores de paradas o clientes según la vista activa
  readonly commercialMarkers = computed<MapMarker[]>(() => {
    const view = this.activeCommercialMapView();
    const salesMap = this.customerSalesMap();
    const customers = this.rawCustomers().filter((c) => c.cus_lat != null && c.cus_lng != null);

    if (view === 'HEATMAP') {
      return customers.map((c) => {
        const sales = salesMap.get(c.cus_uuid) || 0;
        return {
          id: c.cus_uuid,
          lng: Number(c.cus_lng),
          lat: Number(c.cus_lat),
          color: '#ef4444',
          label: '🔥',
          title: c.cus_name,
          popupHtml: `
            <div class="p-1">
              <span class="badge bg-danger mb-1">🔥 Cliente Activo</span>
              <strong class="d-block text-dark">${c.cus_name}</strong>
              <small class="text-muted d-block">${c.cus_address || 'Sin dirección'}</small>
              <div class="fw-bold text-success mt-1">Facturación: ${this.formatMoney(sales)}</div>
            </div>
          `
        };
      });
    }

    if (view === 'COLD_ZONES') {
      return this.coldZoneCustomers().map((c) => ({
        id: c.cus_uuid,
        lng: Number(c.cus_lng),
        lat: Number(c.cus_lat),
        color: '#3b82f6',
        label: '❄',
        title: c.cus_name,
        popupHtml: `
          <div class="p-1">
            <span class="badge bg-primary-subtle text-primary mb-1">Zona Fría / Preventa</span>
            <strong class="d-block text-dark">${c.cus_name}</strong>
            <small class="text-muted d-block">${c.cus_address || 'Sin dirección'}</small>
            <div class="small text-danger fw-semibold mt-1">Sin compras registradas</div>
            ${c.cus_phone ? `<div class="small mt-1"><i class="bi bi-telephone"></i> ${c.cus_phone}</div>` : ''}
          </div>
        `
      }));
    }

    return customers.map((c) => {
      const sales = salesMap.get(c.cus_uuid) || 0;
      const isCold = sales === 0;
      return {
        id: c.cus_uuid,
        lng: Number(c.cus_lng),
        lat: Number(c.cus_lat),
        color: isCold ? '#3b82f6' : '#10b981',
        label: isCold ? '❄' : '✓',
        title: c.cus_name,
        popupHtml: `
          <div class="p-1">
            <strong class="d-block text-dark">${c.cus_name}</strong>
            <small class="text-muted d-block">${c.cus_address || 'Sin dirección'}</small>
            <div class="small fw-bold mt-1 ${isCold ? 'text-secondary' : 'text-success'}">
              ${isCold ? 'Sin compras' : 'Total: ' + this.formatMoney(sales)}
            </div>
          </div>
        `
      };
    });
  });

  public setCommercialMapView(view: 'HEATMAP' | 'COLD_ZONES' | 'ALL_CUSTOMERS'): void {
    this.activeCommercialMapView.set(view);
  }

  // Menús y Overrides para Atajos de Dashboard
  private rawMenuTree = signal<MenuItemTree[]>([]);
  private rawCompanyOverrides = signal<CompanyMenuInterface[]>([]);

  // Fallback vacío por defecto (ningún atajo visible hasta que la empresa lo marque explícitamente)
  private defaultShortcuts: DashboardShortcutItem[] = [];

  // Atajos computados y filtrados dinámicamente
  readonly shortcuts = computed<DashboardShortcutItem[]>(() => {
    const rawTree = this.rawMenuTree();
    const overrides = this.rawCompanyOverrides();

    if (!rawTree || rawTree.length === 0) {
      return [];
    }

    const ovMap = new Map<string, CompanyMenuInterface>();
    overrides.forEach((ov) => ovMap.set(ov.mnu_uuid, ov));

    const list: DashboardShortcutItem[] = [];

    const processNode = (node: MenuItemTree) => {
      const ov = ovMap.get(node.mnu_uuid);

      // Por defecto la visibilidad en Dashboard es false a menos que el override de la empresa lo active explícitamente en true
      const showOnDash = (ov && ov.cmpmnu_showondashboard !== null && ov.cmpmnu_showondashboard !== undefined)
        ? !!ov.cmpmnu_showondashboard
        : false;

      const active = (ov && ov.cmpmnu_active !== null && ov.cmpmnu_active !== undefined)
        ? ov.cmpmnu_active
        : node.mnu_active;

      if (showOnDash && active) {
        const title = (ov && (ov.cmpmnu_dashboardtitle || ov.cmpmnu_title))
          ? (ov.cmpmnu_dashboardtitle || ov.cmpmnu_title)!
          : (node.mnu_dashboardtitle || node.mnu_title);

        const icon = (ov && (ov.cmpmnu_dashboardicon || ov.cmpmnu_icon))
          ? (ov.cmpmnu_dashboardicon || ov.cmpmnu_icon)!
          : (node.mnu_dashboardicon || node.mnu_icon || 'bi-grid-fill');

        const order = (ov && ov.cmpmnu_order !== null && ov.cmpmnu_order !== undefined)
          ? ov.cmpmnu_order
          : node.mnu_order;

        let cleanRoute = (node.mnu_route || '').trim();
        if (cleanRoute.startsWith('/admin/user/')) {
          cleanRoute = cleanRoute.replace('/admin/user/', '');
        } else if (cleanRoute.startsWith('/')) {
          cleanRoute = cleanRoute.substring(1);
        }

        if (cleanRoute && cleanRoute !== 'dashboard') {
          list.push({
            key: node.mnu_cod || cleanRoute || node.mnu_uuid,
            route: `/admin/user/${cleanRoute}`,
            title,
            icon,
            order,
          });
        }
      }

      if (node.items && node.items.length > 0) {
        node.items.forEach((child) => processNode(child));
      }
    };

    rawTree.forEach((root) => processNode(root));

    if (list.length === 0) {
      return [];
    }

    const filtered = this._filterShortcutsByRbac(list);
    filtered.sort((a, b) => a.order - b.order);
    return filtered;
  });

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
        this.loadMenuShortcuts(comp.cmp_uuid);
      }
    });
  }

  public ngOnInit(): void {
    this.loadDashboardData();
    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid;
    if (cmpUuid) {
      this.loadMenuShortcuts(cmpUuid);
    }
  }

  private loadMenuShortcuts(cmpUuid: string): void {
    forkJoin({
      tree: this._menusService.getMenuTree().pipe(catchError(() => of({ data: [] }))),
      overrides: this._companyMenusService.getCompanyMenus(cmpUuid).pipe(catchError(() => of({ data: [] }))),
    }).subscribe({
      next: ({ tree, overrides }) => {
        this.rawMenuTree.set(tree.data || []);
        this.rawCompanyOverrides.set(overrides.data || []);
      },
    });
  }

  private _filterShortcutsByRbac(items: DashboardShortcutItem[]): DashboardShortcutItem[] {
    return items.filter((item) => {
      const r = item.route.toLowerCase();

      if (r.includes('production') && !this.showProduction()) return false;
      if (r.includes('new-order') && !this.showSales()) return false;
      if (r.includes('delivery') && !this._companyContext.canDeliver()) return false;
      if (r.includes('orders') && !this.showOrdersHistory()) return false;
      if (r.includes('customers') && !this.showCustomers()) return false;
      if (r.includes('products') && !this.showProducts()) return false;
      if (r.includes('price-tiers') && !this.showPriceTiers()) return false;
      if (r.includes('machines') && !this.showMachines()) return false;
      if (r.includes('stock-movements') && !this.showStockMovements()) return false;
      if (r.includes('team') && !this.showTeam()) return false;

      return true;
    });
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
          this.rawOrders.set(res.data);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('No se pudieron consultar los pedidos de la jornada.');
        console.warn('Error al cargar pedidos para dashboard:', err);
      }
    });

    // Cargar Clientes para Inteligencia Comercial y Mapa de Calor
    this._customerService.getCustomers(cmp_uuid).subscribe({
      next: (res) => {
        if (res?.data && Array.isArray(res.data)) {
          this.rawCustomers.set(res.data);
        }
      },
      error: (err) => console.warn('Error al cargar clientes para heatmap:', err)
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
