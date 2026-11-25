import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompanyContextService } from '@services/company-context';
import { StockMovementsService, StockMovementFilters } from '@services/stock-movements';
import { ProductService } from '@services/products';
import { StockMovementInterface, StockMovementType } from '@interfaces/stock-movement';
import { ProductInterface } from '@interfaces/product';

@Component({
  selector: 'app-stock-movements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-movements.html',
  styleUrl: './stock-movements.scss'
})
export class StockMovements implements OnInit {
  private readonly _companyContext = inject(CompanyContextService);
  private readonly _stockMovementsService = inject(StockMovementsService);
  private readonly _productService = inject(ProductService);

  // Empresa activa
  readonly activeCompany = this._companyContext.activeCompany;

  // Estados reactivos
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Datos
  readonly movements = signal<StockMovementInterface[]>([]);
  readonly products = signal<ProductInterface[]>([]);

  // Filtros
  readonly selectedProductUuid = signal<string>('');
  readonly selectedType = signal<string>('');
  readonly filterStartDate = signal<string>('');
  readonly filterEndDate = signal<string>('');
  readonly searchQuery = signal<string>('');

  // Modal de Ajuste Manual
  readonly isAdjustmentModalOpen = signal<boolean>(false);
  readonly adjProductUuid = signal<string>('');
  readonly adjType = signal<StockMovementType>('MANUAL_IN');
  readonly adjQuantity = signal<number>(10);
  readonly adjNotes = signal<string>('');

  // Movimientos filtrados
  readonly filteredMovements = computed<StockMovementInterface[]>(() => {
    const list = this.movements();
    const prdUuid = this.selectedProductUuid();
    const type = this.selectedType();
    const query = this.searchQuery().trim().toLowerCase();
    const start = this.filterStartDate();
    const end = this.filterEndDate();

    return list.filter((m) => {
      // Filtro por producto
      if (prdUuid && m.prd_uuid !== prdUuid) return false;

      // Filtro por tipo
      if (type && m.stkm_type !== type) return false;

      // Filtro por fechas
      if (start || end) {
        const mDate = new Date(m.stkm_createdat || '').getTime();
        if (start && mDate < new Date(start).getTime()) return false;
        if (end) {
          const endDateObj = new Date(end);
          endDateObj.setHours(23, 59, 59, 999);
          if (mDate > endDateObj.getTime()) return false;
        }
      }

      // Filtro de búsqueda libre
      if (query) {
        const prd = this.products().find((p) => p.prd_uuid === m.prd_uuid);
        const prdName = prd?.prd_name?.toLowerCase() || '';
        const notes = (m.stkm_notes || '').toLowerCase();
        const ref = (m.stkm_referenceuuid || '').toLowerCase();
        const matchesQuery = prdName.includes(query) || notes.includes(query) || ref.includes(query);
        if (!matchesQuery) return false;
      }

      return true;
    });
  });

  // KPIs Resumen
  readonly kpiTotalInputs = computed<number>(() => {
    return this.filteredMovements()
      .filter((m) => m.stkm_quantity > 0)
      .reduce((acc, m) => acc + Number(m.stkm_quantity), 0);
  });

  readonly kpiTotalOutputs = computed<number>(() => {
    return this.filteredMovements()
      .filter((m) => m.stkm_quantity < 0 && m.stkm_type !== 'WASTE')
      .reduce((acc, m) => acc + Math.abs(Number(m.stkm_quantity)), 0);
  });

  readonly kpiTotalWaste = computed<number>(() => {
    return this.filteredMovements()
      .filter((m) => m.stkm_type === 'WASTE')
      .reduce((acc, m) => acc + Math.abs(Number(m.stkm_quantity)), 0);
  });

  public ngOnInit(): void {
    this.loadData();
  }

  public loadData(): void {
    const cmp = this.activeCompany();
    if (!cmp?.cmp_uuid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    // 1. Cargar catálogo de productos para enriquecer nombres
    this._productService.getProducts(cmp.cmp_uuid).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        this.products.set(list);
        if (list.length > 0 && !this.adjProductUuid()) {
          this.adjProductUuid.set(list[0].prd_uuid);
        }
      },
      error: (err) => console.warn('Aviso: no se pudieron cargar productos:', err)
    });

    // 2. Cargar historial del Kardex
    this.fetchMovements(cmp.cmp_uuid);
  }

  public fetchMovements(cmpUuid: string): void {
    const filters: StockMovementFilters = {};
    if (this.selectedProductUuid()) filters.prd_uuid = this.selectedProductUuid();
    if (this.selectedType()) filters.type = this.selectedType();
    if (this.filterStartDate()) filters.start_date = this.filterStartDate();
    if (this.filterEndDate()) filters.end_date = this.filterEndDate();

    this._stockMovementsService.getStockMovements(cmpUuid, filters).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const list = Array.isArray(res) ? res : (res as any)?.data || [];
        // Ordenar por fecha descendente (más recientes primero)
        list.sort((a: any, b: any) => {
          const dateA = new Date(a.stkm_createdat || 0).getTime();
          const dateB = new Date(b.stkm_createdat || 0).getTime();
          return dateB - dateA;
        });
        this.movements.set(list);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error al cargar movimientos de stock:', err);
        this.errorMessage.set(err.error?.message || 'No se pudieron recuperar los movimientos de stock.');
      }
    });
  }

  public onFilterChange(): void {
    const cmp = this.activeCompany();
    if (cmp?.cmp_uuid) {
      this.fetchMovements(cmp.cmp_uuid);
    }
  }

  public resetFilters(): void {
    this.selectedProductUuid.set('');
    this.selectedType.set('');
    this.filterStartDate.set('');
    this.filterEndDate.set('');
    this.searchQuery.set('');
    this.onFilterChange();
  }

  public openAdjustmentModal(): void {
    this.isAdjustmentModalOpen.set(true);
    this.adjQuantity.set(10);
    this.adjNotes.set('');
    this.adjType.set('MANUAL_IN');
    if (!this.adjProductUuid() && this.products().length > 0) {
      this.adjProductUuid.set(this.products()[0].prd_uuid);
    }
  }

  public closeAdjustmentModal(): void {
    this.isAdjustmentModalOpen.set(false);
    this.errorMessage.set(null);
  }

  public submitAdjustment(): void {
    const cmp = this.activeCompany();
    if (!cmp?.cmp_uuid) return;

    const prdUuid = this.adjProductUuid();
    const type = this.adjType();
    const rawQty = Number(this.adjQuantity());
    const notes = this.adjNotes().trim();

    if (!prdUuid) {
      this.errorMessage.set('Debe seleccionar un producto.');
      return;
    }

    if (isNaN(rawQty) || rawQty <= 0) {
      this.errorMessage.set('La cantidad debe ser mayor a cero.');
      return;
    }

    // Determinar signo según el tipo de movimiento
    let finalQty = rawQty;
    if (type === 'WASTE' || type === 'BOM_CONSUMPTION' || type === 'ORDER_OUT') {
      finalQty = -rawQty;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const payload: Partial<StockMovementInterface> = {
      cmp_uuid: cmp.cmp_uuid,
      prd_uuid: prdUuid,
      stkm_type: type,
      stkm_quantity: finalQty,
      stkm_notes: notes || `Ajuste manual de stock (${type})`
    };

    this._stockMovementsService.saveStockMovement(payload).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.closeAdjustmentModal();
        const prd = this.products().find((p) => p.prd_uuid === prdUuid);
        const name = prd?.prd_name || 'Producto';
        this.successMessage.set(`¡Movimiento registrado con éxito! Balance de ${name} actualizado.`);

        // Recargar Kardex y catálogo para reflejar nuevo stock
        this.loadData();

        setTimeout(() => this.successMessage.set(null), 5000);
      },
      error: (err) => {
        this.isSaving.set(false);
        console.error('Error al guardar movimiento manual:', err);
        this.errorMessage.set(err.error?.message || err.error?.error || 'No se pudo asentar el ajuste de stock.');
      }
    });
  }

  public getProductName(prdUuid: string): string {
    const found = this.products().find((p) => p.prd_uuid === prdUuid);
    return found ? `${found.prd_name} (${found.prd_unitlabel || 'u.'})` : 'Producto / Insumo';
  }

  public isSupplyProduct(prdUuid: string): boolean {
    const found = this.products().find((p) => p.prd_uuid === prdUuid);
    return found?.prd_type === 'SUPPLY';
  }

  public getTypeBadgeClass(type: string | StockMovementType): string {
    switch (type) {
      case 'PRODUCTION_IN':
        return 'badge bg-success-subtle text-success border border-success-subtle';
      case 'BOM_CONSUMPTION':
        return 'badge bg-warning-subtle text-warning-emphasis border border-warning-subtle';
      case 'WASTE':
        return 'badge bg-danger-subtle text-danger border border-danger-subtle';
      case 'ORDER_OUT':
        return 'badge bg-primary-subtle text-primary border border-primary-subtle';
      case 'ORDER_CANCEL_IN':
        return 'badge bg-secondary-subtle text-secondary border border-secondary-subtle';
      case 'MANUAL_IN':
        return 'badge bg-info-subtle text-info-emphasis border border-info-subtle';
      case 'ADJUSTMENT':
      default:
        return 'badge bg-purple-subtle text-purple border border-purple-subtle';
    }
  }

  public getTypeLabel(type: string | StockMovementType): string {
    switch (type) {
      case 'PRODUCTION_IN':
        return 'Producción (+)';
      case 'BOM_CONSUMPTION':
        return 'Consumo Receta (-)';
      case 'WASTE':
        return 'Merma (-)';
      case 'ORDER_OUT':
        return 'Venta / Salida (-)';
      case 'ORDER_CANCEL_IN':
        return 'Reingreso Cancelación (+)';
      case 'MANUAL_IN':
        return 'Ingreso Manual (+)';
      case 'ADJUSTMENT':
        return 'Ajuste de Auditoría';
      default:
        return String(type);
    }
  }

  public formatMovementDate(dateStr?: Date | string): string {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(dateStr);
    }
  }
}
