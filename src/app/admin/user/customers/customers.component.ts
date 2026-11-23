import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CustomerService } from '@services/customers';
import { PriceTierService } from '@services/price-tiers';
import { CompanyContextService } from '@services/company-context';
import { PriceTierInterface } from '@interfaces/price-tier';
import { CustomerInterface } from '@interfaces/customer';

export type CustomerTierCode = 'A' | 'B' | 'C';

export interface CustomerViewItem {
  id: string;
  name: string;
  tier: CustomerTierCode;
  address: string;
  phone: string;
}

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss'
})
export class CustomersComponent implements OnInit {
  private readonly _customerService = inject(CustomerService);
  private readonly _priceTierService = inject(PriceTierService);
  private readonly _companyContext = inject(CompanyContextService);

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
              phone: c.cus_phone || ''
            };
          });
          this.customers.set(mapped);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('No se pudo conectar al servidor para cargar los clientes.');
        console.warn('Error al cargar clientes desde API:', err);
      }
    });
  }

  public getWhatsAppUrl(phone: string): string {
    const clean = phone.replace(/\D/g, '');
    return `https://wa.me/549${clean}`;
  }

  public openQuickCustomerModal(): void {
    this.editingCustomerId.set(null);
    this.newCustomerName.set('');
    this.newCustomerAddress.set('');
    this.newCustomerPhone.set('');
    this.newCustomerTier.set('C');
    this.modalErrorMessage.set(null);
    this.isSaving.set(false);
    this.showQuickCustomerModal.set(true);
  }

  public openEditCustomerModal(customer: CustomerViewItem): void {
    this.editingCustomerId.set(customer.id);
    this.newCustomerName.set(customer.name);
    this.newCustomerAddress.set(customer.address);
    this.newCustomerPhone.set(customer.phone);
    this.newCustomerTier.set(customer.tier);
    this.modalErrorMessage.set(null);
    this.isSaving.set(false);
    this.showQuickCustomerModal.set(true);
  }

  public closeQuickCustomerModal(): void {
    if (this.isSaving()) return;
    this.showQuickCustomerModal.set(false);
    this.editingCustomerId.set(null);
    this.modalErrorMessage.set(null);
    this.isSaving.set(false);
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
}
