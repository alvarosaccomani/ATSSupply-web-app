import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

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
export class CustomersComponent {
  // Lista de clientes
  readonly customers = signal<CustomerViewItem[]>([
    { id: 'cus-1', name: 'DISTRIBUIDORA ERRAMUSPE', tier: 'A', address: 'Ruta 7 Km 68', phone: '2323551100' },
    { id: 'cus-2', name: 'KITA', tier: 'A', address: 'Av. Constitución 1240', phone: '2323552200' },
    { id: 'cus-3', name: 'LA MATERA', tier: 'A', address: 'San Martín 450', phone: '' },
    { id: 'cus-4', name: 'DONBLU', tier: 'A', address: 'Acceso Oeste Colectora', phone: '' },
    { id: 'cus-5', name: 'ARRUS', tier: 'B', address: 'Mitre 890', phone: '' },
    { id: 'cus-6', name: 'CANCHA ATENEO', tier: 'B', address: 'Pellegrini y Francia', phone: '' },
    { id: 'cus-7', name: 'PARRILLA KAPI', tier: 'B', address: 'Humberto 2130', phone: '' },
    { id: 'cus-8', name: 'DESPENSA DAMIAN', tier: 'C', address: 'Roma y Vélez Sarsfield', phone: '' },
    { id: 'cus-9', name: 'DESPENSA MARU', tier: 'C', address: 'Alsina 1120', phone: '' }
  ]);

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

    const newCus: CustomerViewItem = {
      id: 'cus-' + Date.now(),
      name: name.toUpperCase(),
      address: this.newCustomerAddress().trim(),
      phone: this.newCustomerPhone().trim(),
      tier: this.newCustomerTier()
    };

    this.customers.update((list) => [newCus, ...list]);
    this.closeQuickCustomerModal();
  }
}
