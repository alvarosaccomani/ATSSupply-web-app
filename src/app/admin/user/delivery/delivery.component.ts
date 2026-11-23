import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export type DeliveryStatus = 'PENDIENTE DE ENTREGA' | 'PAGADO' | 'ENTREGADO DEBE' | 'CUENTA CORRIENTE';

export interface DeliveryOrderItem {
  id: string;
  customerName: string;
  address: string;
  phone?: string;
  detailSummary: string;
  notes?: string;
  total: number;
  status: DeliveryStatus;
  items: { productId: string; qty: number }[];
}

export interface TruckLoadItem {
  productId: string;
  productName: string;
  totalBags: number;
}

@Component({
  selector: 'app-delivery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './delivery.component.html',
  styleUrl: './delivery.component.scss'
})
export class DeliveryComponent {
  // Catálogo de productos para consolidar la estiba
  readonly products = signal<{ id: string; name: string }[]>([
    { id: 'prd-2', name: 'Bolsa 2 kg' },
    { id: 'prd-3', name: 'Bolsa 3 kg' },
    { id: 'prd-5', name: 'Bolsa 5 kg' },
    { id: 'prd-15', name: 'Bolsa 15 kg' }
  ]);

  // Pedidos asignados a la hoja de ruta
  readonly orders = signal<DeliveryOrderItem[]>([
    {
      id: 'ord-101',
      customerName: 'DISTRIBUIDORA ERRAMUSPE',
      address: 'Ruta 7 Km 68',
      phone: '2323551100',
      detailSummary: '15x Bolsa 3 kg',
      notes: 'Entregar antes de las 17 hs',
      total: 45000,
      status: 'PENDIENTE DE ENTREGA',
      items: [{ productId: 'prd-3', qty: 15 }]
    },
    {
      id: 'ord-102',
      customerName: 'KITA',
      address: 'Av. Constitución 1240',
      phone: '2323552200',
      detailSummary: '100x Bolsa 15 kg',
      notes: 'Descargar por portón lateral',
      total: 1500000,
      status: 'PENDIENTE DE ENTREGA',
      items: [{ productId: 'prd-15', qty: 100 }]
    },
    {
      id: 'ord-104',
      customerName: 'ARRUS',
      address: 'Mitre 890',
      phone: '',
      detailSummary: '20x Bolsa 2 kg, 10x Bolsa 5 kg',
      notes: 'Cobro en efectivo',
      total: 105000,
      status: 'PENDIENTE DE ENTREGA',
      items: [
        { productId: 'prd-2', qty: 20 },
        { productId: 'prd-5', qty: 10 }
      ]
    },
    {
      id: 'ord-105',
      customerName: 'DESPENSA DAMIAN',
      address: 'Roma y Vélez Sarsfield',
      phone: '',
      detailSummary: '5x Bolsa 3 kg',
      notes: '',
      total: 20000,
      status: 'PENDIENTE DE ENTREGA',
      items: [{ productId: 'prd-3', qty: 5 }]
    }
  ]);

  // Computed Signals
  readonly pendingDeliveries = computed<DeliveryOrderItem[]>(() =>
    this.orders().filter((o) => o.status === 'PENDIENTE DE ENTREGA')
  );

  readonly completedDeliveries = computed<DeliveryOrderItem[]>(() =>
    this.orders().filter((o) => o.status !== 'PENDIENTE DE ENTREGA')
  );

  readonly truckLoadSummary = computed<TruckLoadItem[]>(() => {
    const pending = this.pendingDeliveries();
    const productMap: Record<string, number> = {
      'prd-2': 0,
      'prd-3': 0,
      'prd-5': 0,
      'prd-15': 0
    };

    pending.forEach((o) => {
      o.items.forEach((i) => {
        productMap[i.productId] = (productMap[i.productId] || 0) + i.qty;
      });
    });

    return this.products().map((p) => ({
      productId: p.id,
      productName: p.name,
      totalBags: productMap[p.id] || 0
    }));
  });

  readonly totalTruckBags = computed<number>(() =>
    this.truckLoadSummary().reduce((acc, item) => acc + item.totalBags, 0)
  );

  readonly totalPendingAmount = computed<number>(() =>
    this.pendingDeliveries().reduce((acc, o) => acc + o.total, 0)
  );

  readonly totalCollectedAmount = computed<number>(() =>
    this.orders()
      .filter((o) => o.status === 'PAGADO')
      .reduce((acc, o) => acc + o.total, 0)
  );

  public markDeliveryStatus(orderId: string, status: DeliveryStatus): void {
    this.orders.update((list) =>
      list.map((order) =>
        order.id === orderId ? { ...order, status } : order
      )
    );
  }

  public openNavigationMap(address: string): void {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
  }

  public formatMoney(amount: number): string {
    return '$' + amount.toLocaleString('es-AR');
  }
}
