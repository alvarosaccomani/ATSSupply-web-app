import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CustomerService } from '@services/customers';
import { CompanyContextService } from '@services/company-context';

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
  private readonly _companyContext = inject(CompanyContextService);

  // Lista de clientes conectada a la API
  readonly customers = signal<CustomerViewItem[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly searchQuery = signal<string>('');

  // Modal Alta Rápida
  readonly showQuickCustomerModal = signal<boolean>(false);
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
      }
    });
  }

  public ngOnInit(): void {
    this.loadCustomers();
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
          const mapped: CustomerViewItem[] = res.data.map((c) => ({
            id: c.cus_uuid,
            name: c.cus_name,
            tier: 'C',
            address: c.cus_address || '',
            phone: c.cus_phone || ''
          }));
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
    this.newCustomerName.set('');
    this.newCustomerAddress.set('');
    this.newCustomerPhone.set('');
    this.newCustomerTier.set('C');
    this.showQuickCustomerModal.set(true);
  }

  public closeQuickCustomerModal(): void {
    this.showQuickCustomerModal.set(false);
  }

  public saveQuickCustomer(): void {
    const name = this.newCustomerName().trim();
    if (!name) return;

    const cmp_uuid = this._companyContext.activeCompany()?.cmp_uuid;
    if (!cmp_uuid) {
      this.errorMessage.set('No hay una empresa activa seleccionada para registrar clientes.');
      return;
    }

    const tempId = 'cus-' + Date.now();
    const newCus: CustomerViewItem = {
      id: tempId,
      name: name.toUpperCase(),
      address: this.newCustomerAddress().trim(),
      phone: this.newCustomerPhone().trim(),
      tier: this.newCustomerTier()
    };

    // Actualización optimista en memoria
    this.customers.update((list) => [newCus, ...list]);
    this.closeQuickCustomerModal();

    // Persistencia HTTP real en PostgreSQL
    this._customerService
      .saveCustomer({
        cmp_uuid,
        cus_name: newCus.name,
        cus_address: newCus.address,
        cus_phone: newCus.phone,
        cus_active: true
      })
      .subscribe({
        next: (res) => {
          if (res?.data?.cus_uuid) {
            this.customers.update((list) =>
              list.map((c) => (c.id === tempId ? { ...c, id: res.data.cus_uuid } : c))
            );
          }
        },
        error: (err) => {
          console.warn('Error al persistir cliente en backend:', err);
        }
      });
  }
}
