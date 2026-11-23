import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ProductionSupplyItem {
  id: string;
  name: string;
  productId: string;
  stock: number;
  minStock: number;
}

export interface ProductionBatchLog {
  id: string;
  machine: string;
  productName: string;
  qty: number;
  waste: number;
  time: string;
}

export interface FinishedProductOption {
  id: string;
  name: string;
  stock: number;
}

@Component({
  selector: 'app-production',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './production.component.html',
  styleUrl: './production.component.scss'
})
export class ProductionComponent {
  // Máquinas y Líneas de Producción
  readonly machines = signal<string[]>([
    'Fabricadora Rolito 1',
    'Fabricadora Rolito 2',
    'Cámara Escama'
  ]);

  // Productos terminados
  readonly products = signal<FinishedProductOption[]>([
    { id: 'prd-2', name: 'Bolsa 2 kg', stock: 180 },
    { id: 'prd-3', name: 'Bolsa 3 kg', stock: 240 },
    { id: 'prd-5', name: 'Bolsa 5 kg', stock: 95 },
    { id: 'prd-15', name: 'Bolsa 15 kg', stock: 35 }
  ]);

  // Inventario de insumos (recetas / BOM)
  readonly supplies = signal<ProductionSupplyItem[]>([
    { id: 'sup-2', name: 'Bolsas plásticas vacías 2 kg', productId: 'prd-2', stock: 600, minStock: 200 },
    { id: 'sup-3', name: 'Bolsas plásticas vacías 3 kg', productId: 'prd-3', stock: 850, minStock: 250 },
    { id: 'sup-5', name: 'Bolsas plásticas vacías 5 kg', productId: 'prd-5', stock: 420, minStock: 150 },
    { id: 'sup-15', name: 'Bolsas plásticas vacías 15 kg', productId: 'prd-15', stock: 140, minStock: 100 }
  ]);

  // Historial de lotes del día
  readonly productionLogs = signal<ProductionBatchLog[]>([
    { id: 'lot-1', machine: 'Fabricadora Rolito 1', productName: 'Bolsa 3 kg', qty: 150, waste: 3, time: '08:30' },
    { id: 'lot-2', machine: 'Fabricadora Rolito 2', productName: 'Bolsa 15 kg', qty: 80, waste: 1, time: '10:15' }
  ]);

  // Formulario reactivo
  readonly selectedMachine = signal<string>('Fabricadora Rolito 1');
  readonly selectedProductId = signal<string>('prd-3');
  readonly batchQty = signal<number>(100);
  readonly wasteQty = signal<number>(2);
  readonly batchSuccessMessage = signal<string | null>(null);

  // Computed Signals
  readonly selectedProduct = computed<FinishedProductOption>(() =>
    this.products().find((p) => p.id === this.selectedProductId()) ?? this.products()[0]
  );

  readonly associatedSupply = computed<ProductionSupplyItem | undefined>(() =>
    this.supplies().find((s) => s.productId === this.selectedProductId())
  );

  readonly totalConsumedSupplies = computed<number>(
    () => (this.batchQty() || 0) + (this.wasteQty() || 0)
  );

  readonly hasEnoughSupplies = computed<boolean>(() => {
    const supply = this.associatedSupply();
    if (!supply) return true;
    return this.totalConsumedSupplies() <= supply.stock;
  });

  readonly canSubmitBatch = computed<boolean>(
    () => (this.batchQty() || 0) > 0 && this.hasEnoughSupplies()
  );

  readonly totalProducedToday = computed<number>(() =>
    this.productionLogs().reduce((acc, log) => acc + log.qty, 0)
  );

  readonly totalWasteToday = computed<number>(() =>
    this.productionLogs().reduce((acc, log) => acc + log.waste, 0)
  );

  public submitProductionOrder(): void {
    if (!this.canSubmitBatch()) return;

    const prd = this.selectedProduct();
    const qty = this.batchQty();
    const waste = this.wasteQty() || 0;
    const machine = this.selectedMachine();
    const consumed = this.totalConsumedSupplies();

    // 1. Sumar a stock de producto terminado
    this.products.update((list) =>
      list.map((p) => (p.id === prd.id ? { ...p, stock: p.stock + qty } : p))
    );

    // 2. Descontar insumos utilizados
    this.supplies.update((list) =>
      list.map((s) =>
        s.productId === prd.id ? { ...s, stock: Math.max(0, s.stock - consumed) } : s
      )
    );

    // 3. Registrar en historial de producción
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newLog: ProductionBatchLog = {
      id: 'lot-' + Date.now(),
      machine,
      productName: prd.name,
      qty,
      waste,
      time
    };
    this.productionLogs.update((list) => [newLog, ...list]);

    // 4. Mensaje de éxito y reset
    this.batchSuccessMessage.set(
      `¡Lote de ${qty} u. (${prd.name}) sumado a cámara! Insumos descontados: ${consumed} bolsas.`
    );
    this.batchQty.set(100);
    this.wasteQty.set(0);
  }
}
