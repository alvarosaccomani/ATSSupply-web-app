import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

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
export class NewOrderComponent {
  private readonly _router = inject(Router);

  // Clientes cargados para POS
  readonly customers = signal<PosCustomer[]>([
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

  readonly selectedCustomerId = signal<string>('cus-1');

  // Catálogo de Productos con Matriz de Precios
  readonly products = signal<PosProduct[]>([
    { id: 'prd-2', name: 'Bolsa 2 kg', stock: 180, prices: { A: 2000, B: 2500, C: 3000 } },
    { id: 'prd-3', name: 'Bolsa 3 kg', stock: 240, prices: { A: 3000, B: 3500, C: 4000 } },
    { id: 'prd-5', name: 'Bolsa 5 kg', stock: 95, prices: { A: 5000, B: 5500, C: 6000 } },
    { id: 'prd-15', name: 'Bolsa 15 kg', stock: 35, prices: { A: 15000, B: 16000, C: 17000 } }
  ]);

  // Cantidades ingresadas en el borrador
  readonly draftQuantities = signal<Record<string, number>>({
    'prd-2': 0,
    'prd-3': 0,
    'prd-5': 0,
    'prd-15': 0
  });

  readonly orderStatus = signal<string>('PENDIENTE DE ENTREGA');
  readonly orderNotes = signal<string>('');

  // Modal Alta Rápida de Cliente
  readonly showQuickCustomerModal = signal<boolean>(false);
  readonly newCustomerName = signal<string>('');
  readonly newCustomerAddress = signal<string>('');
  readonly newCustomerPhone = signal<string>('');
  readonly newCustomerTier = signal<PriceTierCode>('C');

  // Computed Signals
  readonly selectedCustomer = computed<PosCustomer>(() => {
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
    () => this.totalBags() > 0 && !this.isStockExceeded()
  );

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

    // Descontar stock localmente en los productos
    const quantities = this.draftQuantities();
    this.products.update((list) =>
      list.map((p) => ({
        ...p,
        stock: Math.max(0, p.stock - (quantities[p.id] || 0))
      }))
    );

    // Resetear formulario
    this.draftQuantities.set({
      'prd-2': 0,
      'prd-3': 0,
      'prd-5': 0,
      'prd-15': 0
    });
    this.orderNotes.set('');

    // Redireccionar al dashboard
    this._router.navigate(['/admin/user/dashboard']);
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

    const newCus: PosCustomer = {
      id: 'cus-' + Date.now(),
      name: name.toUpperCase(),
      address: this.newCustomerAddress().trim(),
      phone: this.newCustomerPhone().trim(),
      tier: this.newCustomerTier()
    };

    this.customers.update((list) => [newCus, ...list]);
    this.selectedCustomerId.set(newCus.id);
    this.closeQuickCustomerModal();
  }

  public formatMoney(amount: number): string {
    return '$' + amount.toLocaleString('es-AR');
  }
}
