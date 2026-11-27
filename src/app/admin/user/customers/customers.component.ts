import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { CustomerService } from '@services/customers';
import { PriceTierService } from '@services/price-tiers';
import { CompanyContextService } from '@services/company-context';
import { CustomerMovementsService } from '@services/customer-movements';
import { MapComponent, MapMarker } from '@components/map/map';
import { PriceTierInterface } from '@interfaces/price-tier';
import { CustomerInterface } from '@interfaces/customer';
import { CustomerMovementInterface } from '@interfaces/customer-movement';

export type CustomerTierCode = 'A' | 'B' | 'C';

export interface CustomerViewItem {
  id: string;
  name: string;
  tier: CustomerTierCode;
  address: string;
  phone: string;
  hasCredit: boolean;
  currentBalance: number;
  lat?: number | null;
  lng?: number | null;
}

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MapComponent],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss'
})
export class CustomersComponent implements OnInit {
  private readonly _customerService = inject(CustomerService);
  private readonly _priceTierService = inject(PriceTierService);
  private readonly _companyContext = inject(CompanyContextService);
  private readonly _customerMovementService = inject(CustomerMovementsService);
  private readonly _route = inject(ActivatedRoute);

  // Lista de clientes conectada a la API
  readonly customers = signal<CustomerViewItem[]>([]);
  readonly priceTiers = signal<PriceTierInterface[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly searchQuery = signal<string>('');

  // Modal Alta / Edición de Cliente
  readonly showQuickCustomerModal = signal<boolean>(false);
  readonly editingCustomerId = signal<string | null>(null);
  readonly isSaving = signal<boolean>(false);
  readonly modalErrorMessage = signal<string | null>(null);
  readonly newCustomerName = signal<string>('');
  readonly newCustomerAddress = signal<string>('');
  readonly newCustomerPhone = signal<string>('');
  readonly newCustomerTier = signal<CustomerTierCode>('C');
  readonly newCustomerHasCredit = signal<boolean>(false);
  readonly newCustomerLat = signal<number | null>(null);
  readonly newCustomerLng = signal<number | null>(null);
  readonly isLocating = signal<boolean>(false);

  // Modal Cuenta Corriente / Extracto y Cobranzas
  readonly showStatementModal = signal<boolean>(false);
  readonly activeStatementCustomer = signal<CustomerViewItem | null>(null);
  readonly statementMovements = signal<CustomerMovementInterface[]>([]);
  readonly isLoadingMovements = signal<boolean>(false);
  readonly statementError = signal<string | null>(null);
  readonly statementSuccess = signal<string | null>(null);
  readonly activeStatementBalance = signal<number>(0);

  // Formulario de Cobranza / Pago en Cuenta Corriente
  readonly showPaymentForm = signal<boolean>(false);
  readonly paymentAmount = signal<number | null>(null);
  readonly paymentMethod = signal<string>('EFECTIVO');
  readonly paymentReceipt = signal<string>('');
  readonly paymentNotes = signal<string>('');
  readonly isSubmittingPayment = signal<boolean>(false);

  // Computed Signals
  readonly filteredCustomers = computed<CustomerViewItem[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.customers();
    return this.customers().filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.phone.includes(q)
    );
  });

  readonly tierStats = computed(() => {
    const list = this.customers();
    return {
      total: list.length,
      tierA: list.filter((c) => c.tier === 'A').length,
      tierB: list.filter((c) => c.tier === 'B').length,
      tierC: list.filter((c) => c.tier === 'C').length
    };
  });

  // Centro reactivo para el mapa de geolocalización de cliente
  readonly customerMapCenter = computed<[number, number]>(() => {
    const lat = this.newCustomerLat();
    const lng = this.newCustomerLng();
    if (lat != null && lng != null) {
      return [lng, lat];
    }
    // Si no tiene ubicación aún, buscar si algún cliente cargado tiene GPS para centrar en la zona
    const firstWithGps = this.customers().find((c) => c.lat != null && c.lng != null);
    if (firstWithGps && firstWithGps.lng && firstWithGps.lat) {
      return [firstWithGps.lng, firstWithGps.lat];
    }
    // Default: Córdoba, Argentina
    return [-64.1888, -31.4201];
  });

  // Pin reactivo en el mapa
  readonly customerMapMarkers = computed<MapMarker[]>(() => {
    const lat = this.newCustomerLat();
    const lng = this.newCustomerLng();
    if (lat == null || lng == null) return [];

    const name = this.newCustomerName().trim() || 'Ubicación seleccionada';
    return [
      {
        id: 'customer-pin',
        lng,
        lat,
        title: name,
        color: '#ef4444',
        draggable: true,
        popupHtml: `<strong>${name}</strong><br><span class="text-muted small">Arrastrá el pin para ajustar la entrada</span>`
      }
    ];
  });

  constructor() {
    // Reaccionar automáticamente ante cambios de compañía activa
    effect(() => {
      const comp = this._companyContext.activeCompany();
      if (comp?.cmp_uuid) {
        this.loadCustomers();
        this.loadPriceTiers(comp.cmp_uuid);
      }
    });
  }

  public ngOnInit(): void {
    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;
    this.loadCustomers();
    if (cmp_uuid) {
      this.loadPriceTiers(cmp_uuid);
    }

    this._route.queryParams.subscribe((params) => {
      if (params['openStatement'] === 'true' && params['cus_uuid']) {
        const found = this.customers().find((c) => c.id === params['cus_uuid']);
        if (found && !this.showStatementModal()) {
          this.openStatementModal(found);
        }
      }
    });
  }

  public loadPriceTiers(cmp_uuid: string): void {
    this._priceTierService.getPriceTiers(cmp_uuid).subscribe({
      next: (res) => {
        if (res?.data && Array.isArray(res.data)) {
          this.priceTiers.set(res.data);
        }
      },
      error: (err) => {
        console.warn('No se pudieron cargar las listas de precios:', err);
      }
    });
  }

  public loadCustomers(): void {
    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;
    if (!cmp_uuid) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._customerService.getCustomers(cmp_uuid).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res?.data && Array.isArray(res.data)) {
          const mapped: CustomerViewItem[] = res.data.map((c) => {
            const rawTier = (c.priceTier?.prct_code || 'C').toUpperCase();
            const tierCode: CustomerTierCode = ['A', 'B', 'C'].includes(rawTier)
              ? (rawTier as CustomerTierCode)
              : 'C';

            return {
              id: c.cus_uuid,
              name: c.cus_name,
              tier: tierCode,
              address: c.cus_address || '',
              phone: c.cus_phone || '',
              hasCredit: Boolean(c.cus_hascredit),
              currentBalance: Number(c.cus_currentbalance) || 0,
              lat: c.cus_lat !== undefined && c.cus_lat !== null ? Number(c.cus_lat) : null,
              lng: c.cus_lng !== undefined && c.cus_lng !== null ? Number(c.cus_lng) : null
            };
          });
          this.customers.set(mapped);
          this._checkRouteParamsForStatement(mapped);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('No se pudo conectar al servidor para cargar los clientes.');
        console.warn('Error al cargar clientes desde API:', err);
      }
    });
  }

  private _checkRouteParamsForStatement(list: CustomerViewItem[]): void {
    const params = this._route.snapshot.queryParams;
    if (params['openStatement'] === 'true' && params['cus_uuid']) {
      const found = list.find((c) => c.id === params['cus_uuid']);
      if (found && !this.showStatementModal()) {
        this.openStatementModal(found);
      }
    }
  }

  public getWhatsAppUrl(phone: string): string {
    const clean = phone.replace(/\D/g, '');
    return `https://wa.me/549${clean}`;
  }

  public getGoogleMapsUrl(customer: CustomerViewItem): string {
    if (customer.lat && customer.lng) {
      return `https://www.google.com/maps/search/?api=1&query=${customer.lat},${customer.lng}`;
    }
    const cleanAddress = encodeURIComponent(customer.address);
    return `https://www.google.com/maps/search/?api=1&query=${cleanAddress}`;
  }

  public getCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.modalErrorMessage.set('La geolocalización no está soportada por este dispositivo.');
      return;
    }

    this.isLocating.set(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.isLocating.set(false);
        this.newCustomerLat.set(Number(position.coords.latitude.toFixed(6)));
        this.newCustomerLng.set(Number(position.coords.longitude.toFixed(6)));
      },
      (error) => {
        this.isLocating.set(false);
        let errorMsg = 'No se pudo obtener la ubicación GPS.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Permiso denegado para acceder a la ubicación. Habilitalo en el navegador.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'La señal de GPS no está disponible en este momento.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Se agotó el tiempo de espera para obtener la ubicación GPS.';
        }
        this.modalErrorMessage.set(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  public onMapPointSelected(coords: { lng: number; lat: number }): void {
    this.newCustomerLat.set(Number(coords.lat.toFixed(6)));
    this.newCustomerLng.set(Number(coords.lng.toFixed(6)));
  }

  public clearCustomerGps(): void {
    this.newCustomerLat.set(null);
    this.newCustomerLng.set(null);
  }

  public openQuickCustomerModal(): void {
    this.editingCustomerId.set(null);
    this.newCustomerName.set('');
    this.newCustomerAddress.set('');
    this.newCustomerPhone.set('');
    this.newCustomerTier.set('C');
    this.newCustomerHasCredit.set(false);
    this.newCustomerLat.set(null);
    this.newCustomerLng.set(null);
    this.modalErrorMessage.set(null);
    this.isSaving.set(false);
    this.isLocating.set(false);
    this.showQuickCustomerModal.set(true);
  }

  public openEditCustomerModal(customer: CustomerViewItem): void {
    this.editingCustomerId.set(customer.id);
    this.newCustomerName.set(customer.name);
    this.newCustomerAddress.set(customer.address);
    this.newCustomerPhone.set(customer.phone);
    this.newCustomerTier.set(customer.tier);
    this.newCustomerHasCredit.set(Boolean(customer.hasCredit));
    this.newCustomerLat.set(customer.lat ?? null);
    this.newCustomerLng.set(customer.lng ?? null);
    this.modalErrorMessage.set(null);
    this.isSaving.set(false);
    this.isLocating.set(false);
    this.showQuickCustomerModal.set(true);
  }

  public closeQuickCustomerModal(): void {
    if (this.isSaving()) return;
    this.showQuickCustomerModal.set(false);
    this.editingCustomerId.set(null);
    this.newCustomerLat.set(null);
    this.newCustomerLng.set(null);
    this.newCustomerHasCredit.set(false);
    this.modalErrorMessage.set(null);
    this.isSaving.set(false);
    this.isLocating.set(false);
  }

  public saveQuickCustomer(): void {
    const name = this.newCustomerName().trim();
    const address = this.newCustomerAddress().trim();

    if (!name) {
      this.modalErrorMessage.set('El nombre o razón social del cliente es obligatorio.');
      return;
    }

    if (!address) {
      this.modalErrorMessage.set('La dirección del cliente es obligatoria.');
      return;
    }

    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;
    if (!cmp_uuid) {
      this.modalErrorMessage.set('No hay una empresa activa seleccionada para registrar clientes.');
      return;
    }

    this.isSaving.set(true);
    this.modalErrorMessage.set(null);

    const selectedTierCode = this.newCustomerTier();
    const matchingTier = this.priceTiers().find(
      (t) => t.prct_code?.toUpperCase() === selectedTierCode
    );
    const prct_uuid = matchingTier?.prct_uuid;

    const payload: Partial<CustomerInterface> = {
      cmp_uuid,
      prct_uuid,
      cus_name: name.toUpperCase(),
      cus_address: address,
      cus_phone: this.newCustomerPhone().trim(),
      cus_lat: this.newCustomerLat(),
      cus_lng: this.newCustomerLng(),
      cus_hascredit: this.newCustomerHasCredit(),
      cus_active: true
    };

    const editingId = this.editingCustomerId();

    if (editingId) {
      // Actualización en PostgreSQL
      this._customerService.updateCustomer(cmp_uuid, editingId, payload).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeQuickCustomerModal();
          this.successMessage.set(`Cliente "${name.toUpperCase()}" actualizado con éxito.`);
          this.loadCustomers();
        },
        error: (err) => {
          this.isSaving.set(false);
          console.error('Error al actualizar cliente en backend:', err);
          const errorMsg =
            err.error?.error ||
            err.error?.message ||
            'No se pudo actualizar el cliente en el servidor.';
          this.modalErrorMessage.set(errorMsg);
        }
      });
    } else {
      // Alta en PostgreSQL
      this._customerService.saveCustomer(payload).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeQuickCustomerModal();
          this.successMessage.set(`Cliente "${name.toUpperCase()}" registrado con éxito.`);
          this.loadCustomers();
        },
        error: (err) => {
          this.isSaving.set(false);
          console.error('Error al persistir cliente en backend:', err);
          const errorMsg =
            err.error?.error ||
            err.error?.message ||
            'No se pudo registrar el cliente en el servidor.';
          this.modalErrorMessage.set(errorMsg);
        }
      });
    }
  }

  public openStatementModal(customer: CustomerViewItem): void {
    this.activeStatementCustomer.set(customer);
    this.activeStatementBalance.set(customer.currentBalance);
    this.statementMovements.set([]);
    this.statementError.set(null);
    this.statementSuccess.set(null);
    this.showPaymentForm.set(false);
    this.paymentAmount.set(customer.currentBalance > 0 ? customer.currentBalance : null);
    this.paymentMethod.set('EFECTIVO');
    this.paymentReceipt.set('');
    this.paymentNotes.set('');
    this.showStatementModal.set(true);

    this.loadCustomerStatement(customer.id);
  }

  public closeStatementModal(): void {
    this.showStatementModal.set(false);
    this.activeStatementCustomer.set(null);
    this.statementMovements.set([]);
    this.showPaymentForm.set(false);
    this.statementError.set(null);
    this.statementSuccess.set(null);
  }

  public loadCustomerStatement(cus_uuid: string): void {
    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;
    if (!cmp_uuid) return;

    this.isLoadingMovements.set(true);
    this.statementError.set(null);

    this._customerMovementService.getMovements(cmp_uuid, cus_uuid, { perPage: 50 }).subscribe({
      next: (res) => {
        this.isLoadingMovements.set(false);
        if (res?.data && Array.isArray(res.data)) {
          this.statementMovements.set(res.data);
        }
      },
      error: (err) => {
        this.isLoadingMovements.set(false);
        this.statementError.set('No se pudo cargar el extracto de cuenta corriente.');
        console.warn('Error al cargar movimientos de cuenta corriente:', err);
      }
    });

    // Cargar saldo fresco
    this._customerMovementService.getCustomerBalance(cmp_uuid, cus_uuid).subscribe({
      next: (res) => {
        if (res?.data?.cus_currentbalance !== undefined) {
          const freshBalance = Number(res.data.cus_currentbalance) || 0;
          this.activeStatementBalance.set(freshBalance);
          // Actualizar el cliente en la lista
          this.customers.update((list) =>
            list.map((c) => (c.id === cus_uuid ? { ...c, currentBalance: freshBalance } : c))
          );
        }
      }
    });
  }

  public togglePaymentForm(): void {
    this.showPaymentForm.update((v) => !v);
    this.statementError.set(null);
    this.statementSuccess.set(null);
  }

  public submitPayment(): void {
    const customer = this.activeStatementCustomer();
    const amount = Number(this.paymentAmount());
    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;

    if (!customer || !cmp_uuid) return;

    if (!amount || amount <= 0 || isNaN(amount)) {
      this.statementError.set('El monto de la cobranza debe ser mayor a 0.');
      return;
    }

    this.isSubmittingPayment.set(true);
    this.statementError.set(null);
    this.statementSuccess.set(null);

    this._customerMovementService.registerPayment({
      cmp_uuid,
      cus_uuid: customer.id,
      amount,
      payment_method: this.paymentMethod(),
      receipt_number: this.paymentReceipt().trim() || null,
      notes: this.paymentNotes().trim() || 'Cobranza en cuenta corriente'
    }).subscribe({
      next: (res) => {
        this.isSubmittingPayment.set(false);
        this.statementSuccess.set(`Cobranza de $${amount} registrada con éxito.`);
        this.showPaymentForm.set(false);
        this.paymentAmount.set(null);
        this.paymentReceipt.set('');
        this.paymentNotes.set('');

        // Recargar movimientos y saldo
        this.loadCustomerStatement(customer.id);
        this.loadCustomers();
      },
      error: (err) => {
        this.isSubmittingPayment.set(false);
        const errorMsg = err.error?.error || err.error?.message || 'Error al registrar la cobranza.';
        this.statementError.set(errorMsg);
        console.error('Error al registrar pago en cuenta corriente:', err);
      }
    });
  }

  public getMovementBadgeClass(type: string): string {
    switch (type) {
      case 'ORDER_DEBIT':
      case 'ADJUSTMENT_DEBIT':
        return 'badge bg-danger-subtle text-danger border border-danger-subtle';
      case 'PAYMENT_CREDIT':
        return 'badge bg-success-subtle text-success border border-success-subtle';
      case 'CANCEL_CREDIT':
      case 'ADJUSTMENT_CREDIT':
        return 'badge bg-info-subtle text-info border border-info-subtle';
      default:
        return 'badge bg-secondary-subtle text-secondary';
    }
  }

  public getMovementTypeLabel(type: string): string {
    switch (type) {
      case 'ORDER_DEBIT':
        return 'Entrega Pedido (Debe)';
      case 'PAYMENT_CREDIT':
        return 'Pago / Cobranza (Haber)';
      case 'ADJUSTMENT_DEBIT':
        return 'Ajuste Débito (Debe)';
      case 'ADJUSTMENT_CREDIT':
        return 'Ajuste Crédito (Haber)';
      case 'CANCEL_CREDIT':
        return 'Cancelación Pedido';
      default:
        return type;
    }
  }

  public isDebitMovement(type: string): boolean {
    return type === 'ORDER_DEBIT' || type === 'ADJUSTMENT_DEBIT';
  }
}
