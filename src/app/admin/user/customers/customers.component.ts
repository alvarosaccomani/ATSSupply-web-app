import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { CustomerService } from '@services/customers';
import { PriceTierService } from '@services/price-tiers';
import { CompanyContextService } from '@services/company-context';
import { CustomerMovementsService } from '@services/customer-movements';
import { CustomerFormModal, CustomerModalData } from '@components/customer-form-modal/customer-form-modal';
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
  imports: [CommonModule, FormsModule, RouterLink, CustomerFormModal],
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

  // Modal Alta / Edición de Cliente (Componente Reutilizable)
  readonly showQuickCustomerModal = signal<boolean>(false);
  readonly selectedCustomerForModal = signal<CustomerModalData | null>(null);

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

  public openQuickCustomerModal(): void {
    this.selectedCustomerForModal.set(null);
    this.showQuickCustomerModal.set(true);
  }

  public openEditCustomerModal(customer: CustomerViewItem): void {
    this.selectedCustomerForModal.set({
      id: customer.id,
      name: customer.name,
      address: customer.address,
      phone: customer.phone,
      tier: customer.tier,
      hasCredit: customer.hasCredit,
      lat: customer.lat,
      lng: customer.lng
    });
    this.showQuickCustomerModal.set(true);
  }

  public onCustomerModalClosed(): void {
    this.showQuickCustomerModal.set(false);
    this.selectedCustomerForModal.set(null);
  }

  public onCustomerModalSaved(customer: CustomerInterface): void {
    this.showQuickCustomerModal.set(false);
    this.selectedCustomerForModal.set(null);
    this.successMessage.set(`Cliente "${customer.cus_name}" guardado correctamente.`);
    this.loadCustomers();
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
