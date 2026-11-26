import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { CompanyContextService } from '@services/company-context';
import { OrderService, OrderFilters } from '@services/orders';
import { CustomerService } from '@services/customers';
import { ProductService } from '@services/products';
import { OrderInterface, OrderStatus } from '@interfaces/order';
import { CustomerInterface } from '@interfaces/customer';
import { ProductInterface } from '@interfaces/product';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './orders.html',
  styleUrl: './orders.scss'
})
export class Orders implements OnInit {
  private readonly _companyContext = inject(CompanyContextService);
  private readonly _orderService = inject(OrderService);
  private readonly _customerService = inject(CustomerService);
  private readonly _productService = inject(ProductService);
  private readonly _router = inject(Router);

  // Empresa activa
  readonly activeCompany = this._companyContext.activeCompany;

  // Estados de carga y alertas
  readonly isLoading = signal<boolean>(false);
  readonly isActionLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Listados principales
  readonly rawOrders = signal<OrderInterface[]>([]);
  readonly customers = signal<CustomerInterface[]>([]);
  readonly products = signal<ProductInterface[]>([]);

  // Filtros reactivos
  readonly selectedStatus = signal<string>('');
  readonly selectedCustomerUuid = signal<string>('');
  readonly startDate = signal<string>('');
  readonly endDate = signal<string>('');
  readonly searchQuery = signal<string>('');

  // Modal de Detalle
  readonly isDetailModalOpen = signal<boolean>(false);
  readonly selectedOrder = signal<OrderInterface | null>(null);
  readonly isFetchingDetail = signal<boolean>(false);

  // Modal de Confirmación de Cancelación
  readonly isCancelModalOpen = signal<boolean>(false);
  readonly orderToCancel = signal<OrderInterface | null>(null);

  // Pedidos filtrados localmente
  readonly filteredOrders = computed<OrderInterface[]>(() => {
    const list = this.rawOrders();
    const status = this.selectedStatus();
    const cusUuid = this.selectedCustomerUuid();
    const query = this.searchQuery().trim().toLowerCase();
    const start = this.startDate();
    const end = this.endDate();

    return list.filter((ord) => {
      // Filtro por Estado
      if (status && ord.ord_status !== status) return false;

      // Filtro por Cliente
      if (cusUuid && ord.cus_uuid !== cusUuid) return false;

      // Filtro por Fecha
      if (start || end) {
        const oDate = new Date(ord.ord_orderdate || ord.ord_createdat || '').getTime();
        if (start && oDate < new Date(start).getTime()) return false;
        if (end) {
          const endDateObj = new Date(end);
          endDateObj.setHours(23, 59, 59, 999);
          if (oDate > endDateObj.getTime()) return false;
        }
      }

      // Búsqueda por texto (Nombre de cliente, notas o UUID)
      if (query) {
        const customer = (ord as any).customer || this.customers().find((c) => c.cus_uuid === ord.cus_uuid);
        const cusName = (customer?.cus_name || '').toLowerCase();
        const notes = (ord.ord_notes || '').toLowerCase();
        const uuid = (ord.ord_uuid || '').toLowerCase();
        const matches = cusName.includes(query) || notes.includes(query) || uuid.includes(query);
        if (!matches) return false;
      }

      return true;
    });
  });

  // KPIs Comerciales Computados
  readonly kpiTotalAmount = computed<number>(() => {
    return this.filteredOrders()
      .filter((o) => o.ord_status !== 'CANCELADO')
      .reduce((sum, o) => sum + Number(o.ord_totalamount || 0), 0);
  });

  readonly kpiTotalPaid = computed<number>(() => {
    return this.filteredOrders()
      .filter((o) => o.ord_status === 'PAGADO')
      .reduce((sum, o) => sum + Number(o.ord_totalamount || 0), 0);
  });

  readonly kpiTotalPending = computed<number>(() => {
    return this.filteredOrders()
      .filter((o) => o.ord_status === 'PENDIENTE_DE_ENTREGA' || o.ord_status === 'ENTREGADO_DEBE' || o.ord_status === 'CUENTA_CORRIENTE')
      .reduce((sum, o) => sum + Number(o.ord_totalamount || 0), 0);
  });

  readonly kpiTotalUnits = computed<number>(() => {
    return this.filteredOrders()
      .filter((o) => o.ord_status !== 'CANCELADO')
      .reduce((sum, o) => sum + this.getOrderTotalUnits(o), 0);
  });

  public ngOnInit(): void {
    this.loadData();
  }

  public loadData(): void {
    const cmp = this.activeCompany();
    if (!cmp?.cmp_uuid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    // 1. Cargar clientes para enriquecer selector y nombres
    this._customerService.getCustomers(cmp.cmp_uuid).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : (res as any)?.data || [];
        this.customers.set(list);
      },
      error: (err) => console.warn('Aviso: no se pudieron cargar clientes:', err)
    });

    // 2. Cargar productos para mapear nombres de ítems en el modal
    this._productService.getProducts(cmp.cmp_uuid).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : (res as any)?.data || [];
        this.products.set(list);
      },
      error: (err) => console.warn('Aviso: no se pudieron cargar productos:', err)
    });

    // 3. Cargar pedidos
    this.fetchOrders(cmp.cmp_uuid);
  }

  public fetchOrders(cmpUuid: string): void {
    const filters: OrderFilters = {};
    if (this.selectedStatus()) filters.status = this.selectedStatus();
    if (this.selectedCustomerUuid()) filters.cus_uuid = this.selectedCustomerUuid();
    if (this.startDate()) filters.startDate = this.startDate();
    if (this.endDate()) filters.endDate = this.endDate();

    this._orderService.getOrders(cmpUuid, filters).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const list = Array.isArray(res) ? res : (res as any)?.data || [];
        // Ordenar desc por fecha
        list.sort((a: any, b: any) => {
          const dateA = new Date(a.ord_orderdate || a.ord_createdat || 0).getTime();
          const dateB = new Date(b.ord_orderdate || b.ord_createdat || 0).getTime();
          return dateB - dateA;
        });
        this.rawOrders.set(list);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error al recuperar pedidos:', err);
        this.errorMessage.set(err.error?.message || 'No se pudieron recuperar los pedidos.');
      }
    });
  }

  public onFilterChange(): void {
    const cmp = this.activeCompany();
    if (cmp?.cmp_uuid) {
      this.fetchOrders(cmp.cmp_uuid);
    }
  }

  public resetFilters(): void {
    this.selectedStatus.set('');
    this.selectedCustomerUuid.set('');
    this.startDate.set('');
    this.endDate.set('');
    this.searchQuery.set('');
    this.onFilterChange();
  }

  public openDetailModal(order: OrderInterface): void {
    const cmp = this.activeCompany();
    if (!cmp?.cmp_uuid) return;

    this.isDetailModalOpen.set(true);
    this.selectedOrder.set(order);
    this.isFetchingDetail.set(true);

    // Obtener detalle completo desde el backend para garantizar ítems
    this._orderService.getOrderById(cmp.cmp_uuid, order.ord_uuid).subscribe({
      next: (res) => {
        this.isFetchingDetail.set(false);
        const detail = (res as any)?.data || res;
        this.selectedOrder.set(detail);
      },
      error: (err) => {
        this.isFetchingDetail.set(false);
        console.warn('Aviso: se usa el detalle local del pedido:', err);
      }
    });
  }

  public closeDetailModal(): void {
    this.isDetailModalOpen.set(false);
    this.selectedOrder.set(null);
  }

  public openCancelConfirmation(order: OrderInterface): void {
    this.orderToCancel.set(order);
    this.isCancelModalOpen.set(true);
  }

  public closeCancelModal(): void {
    this.isCancelModalOpen.set(false);
    this.orderToCancel.set(null);
  }

  public confirmCancelOrder(): void {
    const cmp = this.activeCompany();
    const ord = this.orderToCancel();
    if (!cmp?.cmp_uuid || !ord) return;

    this.isActionLoading.set(true);
    this._orderService
      .updateOrder(cmp.cmp_uuid, ord.ord_uuid, { ord_status: 'CANCELADO' })
      .subscribe({
        next: () => {
          this.isActionLoading.set(false);
          this.closeCancelModal();
          this.closeDetailModal();
          this.successMessage.set(`El pedido ${ord.ord_uuid.substring(0, 8)} fue cancelado y su stock reintegrado.`);
          this.loadData();
          setTimeout(() => this.successMessage.set(null), 5000);
        },
        error: (err) => {
          this.isActionLoading.set(false);
          console.error('Error al cancelar pedido:', err);
          this.errorMessage.set(err.error?.message || 'No se pudo cancelar el pedido.');
        }
      });
  }

  public markAsPaid(order: OrderInterface): void {
    const cmp = this.activeCompany();
    if (!cmp?.cmp_uuid) return;

    this.isActionLoading.set(true);
    this._orderService
      .updateOrder(cmp.cmp_uuid, order.ord_uuid, { ord_status: 'PAGADO' })
      .subscribe({
        next: () => {
          this.isActionLoading.set(false);
          this.successMessage.set(`¡Pedido ${order.ord_uuid.substring(0, 8)} marcado como PAGADO!`);
          this.loadData();
          if (this.selectedOrder()?.ord_uuid === order.ord_uuid) {
            this.selectedOrder.update((curr) => curr ? { ...curr, ord_status: 'PAGADO' } : null);
          }
          setTimeout(() => this.successMessage.set(null), 4000);
        },
        error: (err) => {
          this.isActionLoading.set(false);
          console.error('Error al actualizar estado:', err);
          this.errorMessage.set(err.error?.message || 'No se pudo actualizar el estado del pedido.');
        }
      });
  }

  public goToCustomerCheckingAccount(order: OrderInterface): void {
    if (this.selectedOrder()) {
      this.closeDetailModal();
    }
    this._router.navigate(['/admin/user/customers'], {
      queryParams: {
        cus_uuid: order.cus_uuid,
        openStatement: 'true'
      }
    });
  }

  public getCustomerName(order: OrderInterface): string {
    const rawCus = (order as any).customer;
    if (rawCus?.cus_name) return rawCus.cus_name;
    const found = this.customers().find((c) => c.cus_uuid === order.cus_uuid);
    return found ? found.cus_name : 'Cliente no especificado';
  }

  public getCustomerAddress(order: OrderInterface): string {
    const rawCus = (order as any).customer;
    if (rawCus?.cus_address) return rawCus.cus_address;
    const found = this.customers().find((c) => c.cus_uuid === order.cus_uuid);
    return found?.cus_address || 'Sin dirección';
  }

  public getOrderTotalUnits(order: OrderInterface): number {
    const details = order.details || (order as any).items;
    if (!details || !Array.isArray(details)) return 0;
    return details.reduce((acc: number, d: any) => acc + (Number(d.ordd_quantity) || Number(d.qty) || 0), 0);
  }

  public getProductName(prdUuid: string): string {
    const found = this.products().find((p) => p.prd_uuid === prdUuid);
    return found ? `${found.prd_name} (${found.prd_unitlabel || 'u.'})` : 'Producto';
  }

  public formatOrderDate(dateStr?: Date | string): string {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(dateStr);
    }
  }

  public getStatusBadgeClass(status: OrderStatus | string): string {
    switch (status) {
      case 'PAGADO':
        return 'badge bg-success-subtle text-success border border-success-subtle';
      case 'PENDIENTE_DE_ENTREGA':
        return 'badge bg-warning-subtle text-warning-emphasis border border-warning-subtle';
      case 'ENTREGADO_DEBE':
        return 'badge bg-info-subtle text-info-emphasis border border-info-subtle';
      case 'CUENTA_CORRIENTE':
        return 'badge bg-purple-subtle text-purple border border-purple-subtle';
      case 'CANCELADO':
        return 'badge bg-danger-subtle text-danger border border-danger-subtle';
      default:
        return 'badge bg-secondary-subtle text-secondary border border-secondary-subtle';
    }
  }

  public getStatusLabel(status: OrderStatus | string): string {
    switch (status) {
      case 'PAGADO':
        return 'Pagado';
      case 'PENDIENTE_DE_ENTREGA':
        return 'Pendiente de Entrega';
      case 'ENTREGADO_DEBE':
        return 'Entregado (Debe)';
      case 'CUENTA_CORRIENTE':
        return 'Cuenta Corriente';
      case 'CANCELADO':
        return 'Cancelado';
      default:
        return String(status);
    }
  }
}
