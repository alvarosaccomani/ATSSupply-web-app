import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CustomerService } from '@services/customers';
import { ProductService } from '@services/products';
import { OrderService } from '@services/orders';
import { CompanyContextService } from '@services/company-context';
import { AuthService } from '@services/auth';
import { OrderCreateInput, OrderStatus } from '@interfaces/order';

export type PriceTierCode = 'A' | 'B' | 'C';

export interface PosCustomer {
  id: string;
  name: string;
  tier: PriceTierCode;
  address: string;
  phone: string;
}

export interface PosProduct {
  id: string;
  name: string;
  stock: number;
  prices: Record<PriceTierCode, number>;
}

export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

@Component({
  selector: 'app-new-order',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new-order.component.html',
  styleUrl: './new-order.component.scss'
})
export class NewOrderComponent implements OnInit {
  private readonly _router = inject(Router);
  private readonly _customerService = inject(CustomerService);
  private readonly _productService = inject(ProductService);
  private readonly _orderService = inject(OrderService);
  private readonly _companyContext = inject(CompanyContextService);
  private readonly _authService = inject(AuthService);

  // Estado de carga y feedback
  readonly isLoading = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  // Clientes cargados para POS
  readonly customers = signal<PosCustomer[]>([]);
  readonly selectedCustomerId = signal<string>('');

  // Catálogo de Productos con Matriz de Precios
  readonly products = signal<PosProduct[]>([]);

  // Cantidades ingresadas en el borrador
  readonly draftQuantities = signal<Record<string, number>>({});

  readonly orderStatus = signal<string>('PENDIENTE DE ENTREGA');
  readonly orderNotes = signal<string>('');

  // Modal Alta Rápida de Cliente
  readonly showQuickCustomerModal = signal<boolean>(false);
  readonly isSavingCustomer = signal<boolean>(false);
  readonly modalErrorMessage = signal<string | null>(null);
  readonly newCustomerName = signal<string>('');
  readonly newCustomerAddress = signal<string>('');
  readonly newCustomerPhone = signal<string>('');
  readonly newCustomerTier = signal<PriceTierCode>('C');

  // Computed Signals
  readonly selectedCustomer = computed<PosCustomer | undefined>(() => {
    const id = this.selectedCustomerId();
    return this.customers().find((c) => c.id === id) ?? this.customers()[0];
  });

  readonly activePriceTier = computed<PriceTierCode>(
    () => this.selectedCustomer()?.tier ?? 'C'
  );

  readonly cartItems = computed<CartItem[]>(() => {
    const tier = this.activePriceTier();
    const quantities = this.draftQuantities();
    return this.products()
      .map((p) => {
        const qty = quantities[p.id] || 0;
        const unitPrice = p.prices[tier] || 0;
        return {
          productId: p.id,
          productName: p.name,
          quantity: qty,
          unitPrice,
          subtotal: qty * unitPrice
        };
      })
      .filter((item) => item.quantity > 0);
  });

  readonly totalBags = computed<number>(() =>
    this.cartItems().reduce((acc, item) => acc + item.quantity, 0)
  );

  readonly totalAmount = computed<number>(() =>
    this.cartItems().reduce((acc, item) => acc + item.subtotal, 0)
  );

  readonly isStockExceeded = computed<boolean>(() => {
    const quantities = this.draftQuantities();
    return this.products().some((p) => (quantities[p.id] || 0) > p.stock);
  });

  readonly canSubmit = computed<boolean>(
    () =>
      this.totalBags() > 0 &&
      !this.isStockExceeded() &&
      !!this.selectedCustomerId() &&
      !this.isSubmitting()
  );

  constructor() {
    // Reaccionar ante cambios de compañía activa
    effect(() => {
      const comp = this._companyContext.activeCompany();
      if (comp?.cmp_uuid) {
        this.loadInitialData();
      }
    });
  }

  public ngOnInit(): void {
    this.loadInitialData();
  }

  public loadInitialData(): void {
    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;
    if (!cmp_uuid) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Cargar Clientes
    this._customerService.getCustomers(cmp_uuid).subscribe({
      next: (res) => {
        if (res?.data && Array.isArray(res.data)) {
          const mappedCustomers: PosCustomer[] = res.data.map((c) => ({
            id: c.cus_uuid,
            name: c.cus_name,
            tier: 'C',
            address: c.cus_address || '',
            phone: c.cus_phone || ''
          }));
          this.customers.set(mappedCustomers);
          if (mappedCustomers.length > 0 && !this.selectedCustomerId()) {
            this.selectedCustomerId.set(mappedCustomers[0].id);
          }
        }
      },
      error: (err) => {
        console.warn('Error al cargar clientes para POS:', err);
      }
    });

    // Cargar Productos con Precios
    this._productService.getProducts(cmp_uuid).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res?.data && Array.isArray(res.data)) {
          const mappedProducts: PosProduct[] = res.data.map((p) => {
            const priceMap: Record<PriceTierCode, number> = { A: 0, B: 0, C: 0 };
            if (p.prices && Array.isArray(p.prices)) {
              for (const pr of p.prices) {
                const code = (pr.priceTier?.prct_code || 'C').toUpperCase() as PriceTierCode;
                if (code === 'A' || code === 'B' || code === 'C') {
                  priceMap[code] = Number(pr.prdprc_price) || 0;
                }
              }
            }
            return {
              id: p.prd_uuid,
              name: p.prd_name,
              stock: Number(p.prd_currentstock) || 0,
              prices: priceMap
            };
          });

          this.products.set(mappedProducts);

          // Inicializar borrador
          const initialDraft: Record<string, number> = {};
          for (const prod of mappedProducts) {
            initialDraft[prod.id] = 0;
          }
          this.draftQuantities.set(initialDraft);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('No se pudo cargar el catálogo de productos.');
        console.warn('Error al cargar productos para POS:', err);
      }
    });
  }

  public updateQuantity(productId: string, delta: number): void {
    this.draftQuantities.update((curr) => {
      const currentVal = curr[productId] || 0;
      const nextVal = Math.max(0, currentVal + delta);
      return { ...curr, [productId]: nextVal };
    });
  }

  public setQuantity(productId: string, val: number | string): void {
    const parsed = typeof val === 'number' ? val : parseInt(val, 10);
    const safeVal = isNaN(parsed) ? 0 : Math.max(0, parsed);
    this.draftQuantities.update((curr) => ({
      ...curr,
      [productId]: safeVal
    }));
  }

  public onCustomerChange(newId: string): void {
    this.selectedCustomerId.set(newId);
  }

  public submitOrder(): void {
    if (!this.canSubmit()) {
      return;
    }

    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;
    const seller_uuid = this._authService.currentUser()?.usr_uuid;
    const cus_uuid = this.selectedCustomerId();

    if (!cmp_uuid || !cus_uuid || !seller_uuid) {
      this.errorMessage.set('Datos incompletos para registrar el pedido.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    // Mapeo de estado a convención del backend
    const rawStatus = this.orderStatus();
    let backendStatus: OrderStatus = 'PENDIENTE_DE_ENTREGA';
    if (rawStatus === 'PAGADO') backendStatus = 'PAGADO';
    if (rawStatus === 'ENTREGADO DEBE') backendStatus = 'ENTREGADO_DEBE';
    if (rawStatus === 'CUENTA CORRIENTE') backendStatus = 'CUENTA_CORRIENTE';

    const orderPayload: OrderCreateInput = {
      cmp_uuid,
      cus_uuid,
      usr_uuid_seller: seller_uuid,
      ord_notes: this.orderNotes().trim() || null,
      ord_status: backendStatus,
      details: this.cartItems().map((item) => ({
        prd_uuid: item.productId,
        ordd_quantity: item.quantity,
        ordd_unitprice: item.unitPrice,
        ordd_subtotal: item.subtotal
      }))
    };

    this._orderService.saveOrder(orderPayload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this._router.navigate(['/admin/user/dashboard']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg =
          err.error?.error || err.error?.message || 'Error al persistir el pedido en el servidor.';
        this.errorMessage.set(msg);
      }
    });
  }

  public openQuickCustomerModal(): void {
    this.newCustomerName.set('');
    this.newCustomerAddress.set('');
    this.newCustomerPhone.set('');
    this.newCustomerTier.set('C');
    this.modalErrorMessage.set(null);
    this.isSavingCustomer.set(false);
    this.showQuickCustomerModal.set(true);
  }

  public closeQuickCustomerModal(): void {
    if (this.isSavingCustomer()) return;
    this.showQuickCustomerModal.set(false);
    this.modalErrorMessage.set(null);
  }

  public saveQuickCustomer(): void {
    const name = this.newCustomerName().trim();
    const address = this.newCustomerAddress().trim();

    if (!name || !address) {
      this.modalErrorMessage.set('El nombre y la dirección son obligatorios.');
      return;
    }

    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;
    if (!cmp_uuid) {
      this.modalErrorMessage.set('No se encontró una empresa activa seleccionada.');
      return;
    }

    this.isSavingCustomer.set(true);
    this.modalErrorMessage.set(null);

    // Persistir cliente en backend
    this._customerService
      .saveCustomer({
        cmp_uuid,
        cus_name: name.toUpperCase(),
        cus_address: address,
        cus_phone: this.newCustomerPhone().trim(),
        cus_active: true
      })
      .subscribe({
        next: (res) => {
          this.isSavingCustomer.set(false);
          const savedCus = res?.data;
          if (savedCus && savedCus.cus_uuid) {
            const newCus: PosCustomer = {
              id: savedCus.cus_uuid,
              name: savedCus.cus_name,
              address: savedCus.cus_address,
              phone: savedCus.cus_phone || '',
              tier: this.newCustomerTier()
            };

            this.customers.update((list) => [newCus, ...list]);
            this.selectedCustomerId.set(newCus.id);
            this.showQuickCustomerModal.set(false);
          } else {
            this.modalErrorMessage.set('No se recibieron los datos del cliente creado.');
          }
        },
        error: (err) => {
          this.isSavingCustomer.set(false);
          const msg =
            err.error?.error ||
            err.error?.message ||
            'Error al persistir cliente rápido en el servidor.';
          this.modalErrorMessage.set(msg);
          console.warn('Error al persistir cliente rápido:', err);
        }
      });
  }

  public formatMoney(amount: number): string {
    return '$' + amount.toLocaleString('es-AR');
  }
}
