import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompanyContextService } from '@services/company-context';
import { MachineService } from '@services/machines';
import { ProductionOrderService } from '@services/production-orders';
import { ProductService } from '@services/products';
import { MachineInterface } from '@interfaces/machine';
import { ProductInterface } from '@interfaces/product';
import { ProductionOrderInterface } from '@interfaces/production-order';

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

@Component({
  selector: 'app-production',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './production.component.html',
  styleUrl: './production.component.scss'
})
export class ProductionComponent implements OnInit {
  private readonly _companyContext = inject(CompanyContextService);
  private readonly _machineService = inject(MachineService);
  private readonly _productionOrderService = inject(ProductionOrderService);
  private readonly _productService = inject(ProductService);

  // Estados de carga
  readonly isLoading = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly batchSuccessMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  // Máquinas y Líneas de Producción
  readonly machines = signal<MachineInterface[]>([]);

  // Productos terminados fabricables
  readonly products = signal<ProductInterface[]>([]);

  // Inventario de insumos (recetas / BOM)
  readonly supplies = signal<ProductionSupplyItem[]>([
    { id: 'sup-2', name: 'Bolsas plásticas vacías 2 kg', productId: '', stock: 600, minStock: 200 },
    { id: 'sup-3', name: 'Bolsas plásticas vacías 3 kg', productId: '', stock: 850, minStock: 250 },
    { id: 'sup-5', name: 'Bolsas plásticas vacías 5 kg', productId: '', stock: 420, minStock: 150 },
    { id: 'sup-15', name: 'Bolsas plásticas vacías 15 kg', productId: '', stock: 140, minStock: 100 }
  ]);

  // Historial de lotes del día
  readonly productionLogs = signal<ProductionBatchLog[]>([]);

  // Formulario reactivo
  readonly selectedMachineUuid = signal<string>('');
  readonly selectedProductId = signal<string>('');
  readonly batchQty = signal<number>(100);
  readonly wasteQty = signal<number>(0);

  // Computed Signals
  readonly selectedProduct = computed<ProductInterface | undefined>(() =>
    this.products().find((p) => p.prd_uuid === this.selectedProductId()) ?? this.products()[0]
  );

  readonly selectedMachine = computed<MachineInterface | undefined>(() =>
    this.machines().find((m) => m.mch_uuid === this.selectedMachineUuid()) ?? this.machines()[0]
  );

  readonly associatedSupply = computed<ProductionSupplyItem | undefined>(() =>
    this.supplies().find((s) => s.productId === this.selectedProductId()) ?? this.supplies()[0]
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
    () =>
      !this.isSubmitting() &&
      (this.batchQty() || 0) > 0 &&
      !!this.selectedProductId() &&
      this.hasEnoughSupplies()
  );

  readonly totalProducedToday = computed<number>(() =>
    this.productionLogs().reduce((acc, log) => acc + log.qty, 0)
  );

  readonly totalWasteToday = computed<number>(() =>
    this.productionLogs().reduce((acc, log) => acc + log.waste, 0)
  );

  public ngOnInit(): void {
    this.loadProductionData();
  }

  /**
   * Carga máquinas, productos terminados e historial de partes desde la API.
   */
  public loadProductionData(): void {
    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid || 'cmp-ats-001';
    this.isLoading.set(true);
    this.errorMessage.set(null);

    // 1. Cargar máquinas
    this._machineService.getMachines(cmpUuid).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        this.machines.set(list);
        if (list.length > 0 && !this.selectedMachineUuid()) {
          this.selectedMachineUuid.set(list[0].mch_uuid);
        }
      },
      error: (err) => console.warn('Aviso: no se pudieron cargar máquinas', err)
    });

    // 2. Cargar productos
    this._productService.getProducts(cmpUuid).subscribe({
      next: (res) => {
        const list: ProductInterface[] = Array.isArray(res) ? res : res?.data || [];
        const finishedGoods = list.filter((p) => p.prd_type !== 'SUPPLY' && p.prd_active !== false);
        this.products.set(finishedGoods);

        if (finishedGoods.length > 0) {
          if (!this.selectedProductId()) {
            this.selectedProductId.set(finishedGoods[0].prd_uuid);
          }
          // Vincular insumos con productos por índice / nombre si aún no están vinculados
          this.supplies.update((currSupplies) =>
            currSupplies.map((sup, idx) => ({
              ...sup,
              productId: finishedGoods[idx]?.prd_uuid || sup.productId
            }))
          );
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar productos:', err);
        this.errorMessage.set('No se pudieron recuperar los productos de la empresa.');
        this.isLoading.set(false);
      }
    });

    // 3. Cargar órdenes de producción
    this._productionOrderService.getProductionOrders(cmpUuid).subscribe({
      next: (res) => {
        const list: ProductionOrderInterface[] = Array.isArray(res) ? res : res?.data || [];
        const mappedLogs: ProductionBatchLog[] = list.map((order) => {
          const orderDate = order.prdord_productiondate
            ? new Date(order.prdord_productiondate)
            : new Date();
          const time = `${String(orderDate.getHours()).padStart(2, '0')}:${String(orderDate.getMinutes()).padStart(2, '0')}`;
          const machine = this.machines().find((m) => m.mch_uuid === order.mch_uuid)?.mch_name || 'Línea de Envasado';
          const product = this.products().find((p) => p.prd_uuid === order.prd_uuid)?.prd_name || 'Bolsa de Hielo';

          return {
            id: order.prdord_uuid,
            machine,
            productName: product,
            qty: Number(order.prdord_producedqty) || 0,
            waste: Number(order.prdord_wasteqty) || 0,
            time
          };
        });
        this.productionLogs.set(mappedLogs);
      },
      error: (err) => console.warn('Aviso: no se pudieron cargar órdenes previas', err)
    });
  }

  /**
   * Asienta una orden de producción completada en la API y actualiza el stock.
   */
  public submitProductionOrder(): void {
    if (!this.canSubmitBatch()) return;

    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid || 'cmp-ats-001';
    const prd = this.selectedProduct();
    if (!prd) return;

    const qty = this.batchQty();
    const waste = this.wasteQty() || 0;
    const mchUuid = this.selectedMachineUuid() || undefined;
    const machineName = this.selectedMachine()?.mch_name || 'Línea General';
    const consumed = this.totalConsumedSupplies();

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const payload: Partial<ProductionOrderInterface> = {
      cmp_uuid: cmpUuid,
      mch_uuid: mchUuid,
      prd_uuid: prd.prd_uuid,
      prdord_producedqty: qty,
      prdord_wasteqty: waste,
      prdord_status: 'COMPLETED',
      prdord_productiondate: new Date().toISOString(),
      prdord_notes: `Lote producido en ${machineName}`
    };

    this._productionOrderService.saveProductionOrder(payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);

        // 1. Sumar a stock local y recargar productos
        this.products.update((list) =>
          list.map((p) =>
            p.prd_uuid === prd.prd_uuid
              ? { ...p, prd_currentstock: (p.prd_currentstock || 0) + qty }
              : p
          )
        );

        // 2. Descontar insumos utilizados
        this.supplies.update((list) =>
          list.map((s) =>
            s.productId === prd.prd_uuid
              ? { ...s, stock: Math.max(0, s.stock - consumed) }
              : s
          )
        );

        // 3. Registrar en historial de producción
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const newLog: ProductionBatchLog = {
          id: (res?.data as any)?.prdord_uuid || 'lot-' + Date.now(),
          machine: machineName,
          productName: prd.prd_name,
          qty,
          waste,
          time
        };
        this.productionLogs.update((list) => [newLog, ...list]);

        // 4. Feedback al operario
        this.batchSuccessMessage.set(
          `¡Lote de ${qty} u. (${prd.prd_name}) registrado y sumado al stock! Insumos descontados: ${consumed} u.`
        );
        this.batchQty.set(100);
        this.wasteQty.set(0);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        console.error('Error al asentar parte de producción:', err);
        this.errorMessage.set(
          err.error?.error ||
            err.error?.message ||
            'Ocurrió un error al registrar el lote de producción en la API.'
        );
      }
    });
  }
}
