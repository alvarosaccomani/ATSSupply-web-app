import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompaniesService } from '@services/companies';
import { CompanyItemsService } from '@services/company-items';
import { ItemsService } from '@services/items';
import { CompanyInterface } from '@interfaces/company';
import { ItemInterface } from '@interfaces/item';
import { CompanyItemInterface } from '@interfaces/company-item';

@Component({
  selector: 'app-company-items',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './company-items.html',
  styleUrl: './company-items.scss'
})
export class CompanyItems implements OnInit {
  private readonly _companiesService = inject(CompaniesService);
  private readonly _companyItemsService = inject(CompanyItemsService);
  private readonly _itemsService = inject(ItemsService);

  // Estados de carga y guardado
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Pestaña activa: 'assignment' (Asignación por Empresa) | 'catalog' (Catálogo Maestro de Rubros)
  readonly activeTab = signal<'assignment' | 'catalog'>('assignment');

  // Datos
  readonly companies = signal<CompanyInterface[]>([]);
  readonly selectedCompanyUuid = signal<string>('');
  readonly assignedCompanyItems = signal<CompanyItemInterface[]>([]);
  readonly masterItems = signal<ItemInterface[]>([]);

  // Filtros
  readonly searchCatalogQuery = signal<string>('');

  // Modal para Crear / Editar Rubro Maestro
  readonly isItemModalOpen = signal<boolean>(false);
  readonly isEditingItem = signal<boolean>(false);
  readonly editingItemUuid = signal<string | null>(null);
  readonly formItemName = signal<string>('');
  readonly formItemDescription = signal<string>('');

  // Modal confirmación desvinculación
  readonly itemToUnlink = signal<CompanyItemInterface | null>(null);

  // Empresa seleccionada actualmente
  readonly selectedCompany = computed<CompanyInterface | undefined>(() => {
    const uuid = this.selectedCompanyUuid();
    return this.companies().find((c) => c.cmp_uuid === uuid);
  });

  // Rubros del catálogo maestro aún NO asignados a la empresa seleccionada
  readonly unassignedMasterItems = computed<ItemInterface[]>(() => {
    const assignedUuids = new Set(this.assignedCompanyItems().map((ci) => ci.itm_uuid));
    return this.masterItems().filter((item) => !assignedUuids.has(item.itm_uuid));
  });

  // Catálogo maestro filtrado por búsqueda
  readonly filteredMasterItems = computed<ItemInterface[]>(() => {
    const query = this.searchCatalogQuery().trim().toLowerCase();
    if (!query) return this.masterItems();
    return this.masterItems().filter((itm) => {
      const name = (itm.itm_name || '').toLowerCase();
      const desc = (itm.itm_description || '').toLowerCase();
      return name.includes(query) || desc.includes(query);
    });
  });

  ngOnInit(): void {
    this.loadInitialData();
  }

  public loadInitialData(): void {
    this.loadCompanies();
    this.loadMasterItems();
  }

  public loadCompanies(): void {
    this.isLoading.set(true);
    this._companiesService.getCompanies().subscribe({
      next: (res: any) => {
        this.isLoading.set(false);
        const list: CompanyInterface[] = Array.isArray(res) ? res : res?.data || [];
        this.companies.set(list);

        if (list.length > 0 && !this.selectedCompanyUuid()) {
          this.selectedCompanyUuid.set(list[0].cmp_uuid);
          this.loadAssignedItems(list[0].cmp_uuid);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('Error al cargar la lista de empresas.');
        console.error('Error al cargar empresas:', err);
      }
    });
  }

  public loadMasterItems(): void {
    this._itemsService.getItems().subscribe({
      next: (res: any) => {
        const list: ItemInterface[] = Array.isArray(res) ? res : res?.data || [];
        this.masterItems.set(list);
      },
      error: (err) => console.error('Error al cargar catálogo de rubros:', err)
    });
  }

  public onCompanyChange(cmp_uuid: string): void {
    this.selectedCompanyUuid.set(cmp_uuid);
    this.loadAssignedItems(cmp_uuid);
  }

  public loadAssignedItems(cmp_uuid: string): void {
    if (!cmp_uuid) {
      this.assignedCompanyItems.set([]);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._companyItemsService.getCompanyItems(cmp_uuid).subscribe({
      next: (res: any) => {
        this.isLoading.set(false);
        const list = Array.isArray(res) ? res : res?.data || [];
        this.assignedCompanyItems.set(list);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('No se pudo cargar los rubros de la empresa.');
        console.error('Error al cargar company-items:', err);
      }
    });
  }

  public assignItemToCompany(itm_uuid: string): void {
    const cmp_uuid = this.selectedCompanyUuid();
    if (!cmp_uuid || !itm_uuid) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this._companyItemsService.saveCompanyItem({ cmp_uuid, itm_uuid }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.successMessage.set('Rubro asignado correctamente a la empresa.');
        this.loadAssignedItems(cmp_uuid);
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.message || 'Error al asignar rubro a la empresa.');
        console.error('Error al asignar rubro:', err);
      }
    });
  }

  public confirmUnlinkItem(companyItem: CompanyItemInterface): void {
    this.itemToUnlink.set(companyItem);
  }

  public cancelUnlinkItem(): void {
    this.itemToUnlink.set(null);
  }

  public executeUnlinkItem(): void {
    const item = this.itemToUnlink();
    if (!item) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);

    this._companyItemsService
      .deleteCompanyItem(item.cmp_uuid, item.itm_uuid, item.cmpitm_uuid)
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.itemToUnlink.set(null);
          this.successMessage.set('Rubro desvinculado de la empresa exitosamente.');
          this.loadAssignedItems(item.cmp_uuid);
          setTimeout(() => this.successMessage.set(null), 3000);
        },
        error: (err) => {
          this.isSaving.set(false);
          this.itemToUnlink.set(null);
          this.errorMessage.set(err?.error?.message || 'Error al desvincular rubro.');
          console.error('Error al desvincular rubro:', err);
        }
      });
  }

  // --- CRUD CATÁLOGO MAESTRO DE RUBROS ---

  public openCreateItemModal(): void {
    this.isEditingItem.set(false);
    this.editingItemUuid.set(null);
    this.formItemName.set('');
    this.formItemDescription.set('');
    this.isItemModalOpen.set(true);
  }

  public openEditItemModal(item: ItemInterface): void {
    this.isEditingItem.set(true);
    this.editingItemUuid.set(item.itm_uuid);
    this.formItemName.set(item.itm_name || '');
    this.formItemDescription.set(item.itm_description || '');
    this.isItemModalOpen.set(true);
  }

  public closeItemModal(): void {
    this.isItemModalOpen.set(false);
  }

  public submitMasterItem(): void {
    const name = this.formItemName().trim();
    const description = this.formItemDescription().trim();

    if (!name) {
      this.errorMessage.set('El nombre del rubro es obligatorio.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    if (this.isEditingItem() && this.editingItemUuid()) {
      const itm_uuid = this.editingItemUuid()!;
      this._itemsService.updateItem(itm_uuid, { itm_name: name, itm_description: description }).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.isItemModalOpen.set(false);
          this.successMessage.set(`Rubro ${name} actualizado.`);
          this.loadMasterItems();
          if (this.selectedCompanyUuid()) {
            this.loadAssignedItems(this.selectedCompanyUuid());
          }
          setTimeout(() => this.successMessage.set(null), 3000);
        },
        error: (err) => {
          this.isSaving.set(false);
          this.errorMessage.set(err?.error?.message || 'Error al actualizar rubro.');
        }
      });
    } else {
      this._itemsService.saveItem({ itm_name: name, itm_description: description }).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.isItemModalOpen.set(false);
          this.successMessage.set(`Rubro ${name} creado en el catálogo maestro.`);
          this.loadMasterItems();
          setTimeout(() => this.successMessage.set(null), 3000);
        },
        error: (err) => {
          this.isSaving.set(false);
          this.errorMessage.set(err?.error?.message || 'Error al crear rubro maestro.');
        }
      });
    }
  }

  public deleteMasterItem(item: ItemInterface): void {
    if (!confirm(`¿Eliminar el rubro "${item.itm_name}" del catálogo maestro?`)) return;

    this.isSaving.set(true);
    this._itemsService.deleteItem(item.itm_uuid).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.successMessage.set(`Rubro ${item.itm_name} eliminado.`);
        this.loadMasterItems();
        if (this.selectedCompanyUuid()) {
          this.loadAssignedItems(this.selectedCompanyUuid());
        }
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.message || 'Error al eliminar rubro del catálogo maestro.');
      }
    });
  }
}
