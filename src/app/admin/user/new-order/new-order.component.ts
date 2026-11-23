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
  lat?: number | null;
  lng?: number | null;
  distanceMeters?: number;
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
  readonly isDetectingLocation = signal<boolean>(false);
  readonly nearestCustomerNotice = signal<{ name: string; distanceFormatted: string } | null>(null);

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
          const mappedCustomers: PosCustomer[] = res.data.map((c) => {
            const rawTier = (c.priceTier?.prct_code || 'C').toUpperCase();
            const tierCode: PriceTierCode = ['A', 'B', 'C'].includes(rawTier)
              ? (rawTier as PriceTierCode)
              : 'C';

            return {
              id: c.cus_uuid,
              name: c.cus_name,
              tier: tierCode,
              address: c.cus_address || '',
              phone: c.cus_phone || '',
              lat: c.cus_lat !== undefined && c.cus_lat !== null ? Number(c.cus_lat) : null,
              lng: c.cus_lng !== undefined && c.cus_lng !== null ? Number(c.cus_lng) : null
            };
          });
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
    this.nearestCustomerNotice.set(null);
  }

  /**
   * Calcula la distancia geodésica en metros entre dos coordenadas geográficas
   * utilizando la fórmula de Haversine.
   */
  public calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Radio medio de la Tierra en metros
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const rLat1 = toRad(lat1);
    const rLat2 = toRad(lat2);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(rLat1) * Math.cos(rLat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Formatea la distancia calculada a metros o kilómetros legibles.
   */
  public formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  }

  /**
   * Consulta el GPS del dispositivo, calcula la distancia a todos los clientes
   * con coordenadas y auto-selecciona el cliente más cercano.
   */
  public detectNearestCustomer(): void {
    if (!navigator.geolocation) {
      this.errorMessage.set('La geolocalización no está disponible en este dispositivo.');
      return;
    }

    const customersWithCoords = this.customers().filter((c) => c.lat != null && c.lng != null);
    if (customersWithCoords.length === 0) {
      this.errorMessage.set(
        'Ninguno de los clientes registrados posee coordenadas GPS asignadas.'
      );
      return;
    }

    this.isDetectingLocation.set(true);
    this.errorMessage.set(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.isDetectingLocation.set(false);
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        // Calcular distancia para cada cliente
        const updatedList = this.customers().map((cus) => {
          if (cus.lat != null && cus.lng != null) {
            const dist = this.calculateHaversineDistance(userLat, userLng, cus.lat, cus.lng);
            return { ...cus, distanceMeters: dist };
          }
          return { ...cus, distanceMeters: undefined };
        });

        // Ordenar clientes: primero los que tienen distancia menor, luego los que no tienen coordenadas
        updatedList.sort((a, b) => {
          if (a.distanceMeters != null && b.distanceMeters != null) {
            return a.distanceMeters - b.distanceMeters;
          }
          if (a.distanceMeters != null) return -1;
          if (b.distanceMeters != null) return 1;
          return a.name.localeCompare(b.name);
        });

        this.customers.set(updatedList);

        // El primero de la lista es el más cercano
        const nearest = updatedList[0];
        if (nearest && nearest.distanceMeters != null) {
          this.selectedCustomerId.set(nearest.id);
          this.nearestCustomerNotice.set({
            name: nearest.name,
            distanceFormatted: this.formatDistance(nearest.distanceMeters)
          });
        }
      },
      (error) => {
        this.isDetectingLocation.set(false);
        let msg = 'No se pudo obtener la posición GPS actual.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Permiso denegado para acceder a la ubicación. Habilitalo en el navegador.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'La señal de GPS no está disponible en este momento.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Se agotó el tiempo de espera para obtener la ubicación GPS.';
        }
        this.errorMessage.set(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
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
              lat: savedCus.cus_lat !== undefined && savedCus.cus_lat !== null ? Number(savedCus.cus_lat) : null,
              lng: savedCus.cus_lng !== undefined && savedCus.cus_lng !== null ? Number(savedCus.cus_lng) : null,
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
