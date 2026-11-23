import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompanyContextService } from '@services/company-context';
import { ProductService } from '@services/products';
import { PriceTierService } from '@services/price-tiers';
import { ProductInterface, ProductType } from '@interfaces/product';
import { PriceTierInterface } from '@interfaces/price-tier';

export interface TierPriceFormItem {
  prct_uuid: string;
  tierName: string;
  price: number;
}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products.html',
  styleUrl: './products.scss'
})
export class Products implements OnInit {
  private readonly _companyContext = inject(CompanyContextService);
  private readonly _productService = inject(ProductService);
  private readonly _priceTierService = inject(PriceTierService);

  // Estados de carga y feedback
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  // Datos principales
  readonly products = signal<ProductInterface[]>([]);
  readonly priceTiers = signal<PriceTierInterface[]>([]);

  // Filtros
  readonly searchQuery = signal<string>('');
  readonly selectedTypeFilter = signal<string>('ALL'); // 'ALL' | 'FINISHED' | 'SUPPLY'
  readonly showActiveOnly = signal<boolean>(false);

  // Estado del Modal de Formulario
  readonly isFormOpen = signal<boolean>(false);
  readonly isEditing = signal<boolean>(false);
  readonly currentPrdUuid = signal<string | null>(null);

  // Campos del formulario
  readonly formCode = signal<string>('');
  readonly formName = signal<string>('');
  readonly formType = signal<ProductType>('FINISHED');
  readonly formUnitLabel = signal<string>('Bolsa');
  readonly formWeightOrVolume = signal<number | null>(null);
  readonly formStock = signal<number>(0);
  readonly formMinStock = signal<number>(20);
  readonly formActive = signal<boolean>(true);
  readonly formTierPrices = signal<TierPriceFormItem[]>([]);

  // Computed: Lista filtrada reactiva
  readonly filteredProducts = computed<ProductInterface[]>(() => {
    let list = this.products();
    const query = this.searchQuery().trim().toLowerCase();
    const typeFilter = this.selectedTypeFilter();
    const activeOnly = this.showActiveOnly();

    if (query) {
      list = list.filter(
        (p) =>
          p.prd_name.toLowerCase().includes(query) ||
          (p.prd_code && p.prd_code.toLowerCase().includes(query))
      );
    }

    if (typeFilter !== 'ALL') {
      list = list.filter((p) => p.prd_type === typeFilter);
    }

    if (activeOnly) {
      list = list.filter((p) => p.prd_active !== false);
    }

    return list;
  });

  // KPIs computados
  readonly totalFinished = computed<number>(
    () => this.products().filter((p) => p.prd_type === 'FINISHED').length
  );
  readonly totalSupplies = computed<number>(
    () => this.products().filter((p) => p.prd_type === 'SUPPLY').length
  );
  readonly totalLowStock = computed<number>(
    () =>
      this.products().filter(
        (p) => (p.prd_currentstock || 0) <= (p.prd_minstockalert || 0)
      ).length
  );

  public ngOnInit(): void {
    this.loadData();
  }

  /**
   * Carga el catálogo de productos y las categorías de precios.
   */
  public loadData(): void {
    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid || 'cmp-ats-001';
    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Cargar listas de precios activas
    this._priceTierService.getPriceTiers(cmpUuid).subscribe({
      next: (res) => {
        const tiers = Array.isArray(res) ? res : res?.data || [];
        this.priceTiers.set(tiers.filter((t: PriceTierInterface) => t.prct_active !== false));
      },
      error: (err) => console.warn('Aviso: no se pudieron cargar listas de precios', err)
    });

    // Cargar catálogo de productos
    this._productService.getProducts(cmpUuid).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        this.products.set(list);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar productos:', err);
        this.errorMessage.set('No se pudo recuperar el catálogo de productos.');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Abre el modal para dar de alta un nuevo producto.
   */
  public openCreateModal(): void {
    this.isEditing.set(false);
    this.currentPrdUuid.set(null);
    this.formCode.set('');
    this.formName.set('');
    this.formType.set('FINISHED');
    this.formUnitLabel.set('Bolsa');
    this.formWeightOrVolume.set(null);
    this.formStock.set(0);
    this.formMinStock.set(20);
    this.formActive.set(true);

    // Inicializar precios por cada categoría
    const tierPrices: TierPriceFormItem[] = this.priceTiers().map((t) => ({
      prct_uuid: t.prct_uuid,
      tierName: t.prct_name,
      price: 0
    }));
    this.formTierPrices.set(tierPrices);

    this.isFormOpen.set(true);
  }

  /**
   * Abre el modal para editar un producto existente.
   */
  public openEditModal(product: ProductInterface): void {
    this.isEditing.set(true);
    this.currentPrdUuid.set(product.prd_uuid);
    this.formCode.set(product.prd_code || '');
    this.formName.set(product.prd_name);
    this.formType.set((product.prd_type as ProductType) || 'FINISHED');
    this.formUnitLabel.set(product.prd_unitlabel || 'Bolsa');
    this.formWeightOrVolume.set(product.prd_weightorvolume || null);
    this.formStock.set(product.prd_currentstock || 0);
    this.formMinStock.set(product.prd_minstockalert || 20);
    this.formActive.set(product.prd_active !== false);

    // Mapear precios asignados
    const currentPrices = product.prices || [];
    const tierPrices: TierPriceFormItem[] = this.priceTiers().map((t) => {
      const assigned = currentPrices.find((p) => p.prct_uuid === t.prct_uuid);
      return {
        prct_uuid: t.prct_uuid,
        tierName: t.prct_name,
        price: assigned ? Number(assigned.prdprc_price) || 0 : 0
      };
    });
    this.formTierPrices.set(tierPrices);

    this.isFormOpen.set(true);
  }

  /**
   * Cierra el modal de formulario.
   */
  public closeModal(): void {
    this.isFormOpen.set(false);
  }

  /**
   * Actualiza el precio de una lista específica en el formulario.
   */
  public updateTierPrice(prctUuid: string, newPrice: number): void {
    this.formTierPrices.update((list) =>
      list.map((item) => (item.prct_uuid === prctUuid ? { ...item, price: newPrice } : item))
    );
  }

  /**
   * Persiste la creación o actualización en el backend.
   */
  public saveProduct(): void {
    if (!this.formName().trim()) {
      this.errorMessage.set('El nombre del producto es obligatorio.');
      return;
    }

    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid || 'cmp-ats-001';
    this.isSaving.set(true);
    this.errorMessage.set(null);

    const payload: any = {
      cmp_uuid: cmpUuid,
      prd_code: this.formCode().trim() || null,
      prd_name: this.formName().trim(),
      prd_type: this.formType(),
      prd_unitlabel: this.formUnitLabel().trim() || 'Unidad',
      prd_weightorvolume: this.formWeightOrVolume(),
      prd_currentstock: Number(this.formStock()) || 0,
      prd_minstockalert: Number(this.formMinStock()) || 0,
      prd_active: this.formActive(),
      prices: this.formTierPrices()
        .filter((t) => t.price > 0)
        .map((t) => ({
          cmp_uuid: cmpUuid,
          prct_uuid: t.prct_uuid,
          prdprc_price: Number(t.price)
        }))
    };

    if (this.isEditing() && this.currentPrdUuid()) {
      const prdUuid = this.currentPrdUuid()!;
      this._productService.updateProduct(cmpUuid, prdUuid, payload).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.successMessage.set(`Producto "${payload.prd_name}" actualizado exitosamente.`);
          this.closeModal();
          this.loadData();
        },
        error: (err) => {
          this.isSaving.set(false);
          console.error('Error al actualizar producto:', err);
          this.errorMessage.set(err.error?.message || 'Error al actualizar el producto.');
        }
      });
    } else {
      this._productService.saveProduct(payload).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.successMessage.set(`Producto "${payload.prd_name}" dado de alta exitosamente.`);
          this.closeModal();
          this.loadData();
        },
        error: (err) => {
          this.isSaving.set(false);
          console.error('Error al dar de alta producto:', err);
          this.errorMessage.set(err.error?.message || 'Error al dar de alta el producto.');
        }
      });
    }
  }

  /**
   * Cambia el estado activo/inactivo de un producto.
   */
  public toggleProductActive(product: ProductInterface): void {
    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid || 'cmp-ats-001';
    const newStatus = !product.prd_active;

    this._productService
      .updateProduct(cmpUuid, product.prd_uuid, { prd_active: newStatus })
      .subscribe({
        next: () => {
          this.products.update((list) =>
            list.map((p) => (p.prd_uuid === product.prd_uuid ? { ...p, prd_active: newStatus } : p))
          );
          this.successMessage.set(
            `Producto "${product.prd_name}" ${newStatus ? 'activado' : 'desactivado'}.`
          );
        },
        error: (err) => {
          console.error('Error al cambiar estado de producto:', err);
          this.errorMessage.set('No se pudo actualizar el estado del producto.');
        }
      });
  }

  /**
   * Elimina un producto.
   */
  public deleteProduct(product: ProductInterface): void {
    if (!confirm(`¿Estás seguro de eliminar el producto "${product.prd_name}"?`)) return;

    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid || 'cmp-ats-001';
    this._productService.deleteProduct(cmpUuid, product.prd_uuid).subscribe({
      next: () => {
        this.products.update((list) => list.filter((p) => p.prd_uuid !== product.prd_uuid));
        this.successMessage.set(`Producto "${product.prd_name}" eliminado.`);
      },
      error: (err) => {
        console.error('Error al eliminar producto:', err);
        this.errorMessage.set(
          err.error?.message || 'No se pudo eliminar el producto (puede contener registros asociados).'
        );
      }
    });
  }
}
