import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompanyContextService } from '@services/company-context';
import { PriceTierService } from '@services/price-tiers';
import { PriceTierInterface } from '@interfaces/price-tier';

@Component({
  selector: 'app-price-tiers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './price-tiers.html',
  styleUrl: './price-tiers.scss'
})
export class PriceTiers implements OnInit {
  private readonly _companyContext = inject(CompanyContextService);
  private readonly _priceTierService = inject(PriceTierService);

  // Estados de carga y feedback
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  // Listado
  readonly priceTiers = signal<PriceTierInterface[]>([]);
  readonly searchQuery = signal<string>('');

  // Modal y Formulario
  readonly isFormOpen = signal<boolean>(false);
  readonly isEditing = signal<boolean>(false);
  readonly currentPrctUuid = signal<string | null>(null);

  readonly formCode = signal<string>('');
  readonly formName = signal<string>('');
  readonly formDescription = signal<string>('');
  readonly formActive = signal<boolean>(true);
  readonly formIsDefault = signal<boolean>(false);

  // Computed: filtrado reactivo
  readonly filteredPriceTiers = computed<PriceTierInterface[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.priceTiers();
    if (!query) return list;
    return list.filter(
      (t) =>
        t.prct_name.toLowerCase().includes(query) ||
        (t.prct_code && t.prct_code.toLowerCase().includes(query)) ||
        (t.prct_description && t.prct_description.toLowerCase().includes(query))
    );
  });

  public ngOnInit(): void {
    this.loadData();
  }

  /**
   * Carga las listas de precios desde la API.
   */
  public loadData(): void {
    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid || 'cmp-ats-001';
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._priceTierService.getPriceTiers(cmpUuid).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        this.priceTiers.set(list);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar listas de precios:', err);
        this.errorMessage.set('No se pudieron recuperar las listas de precios de la empresa.');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Abre el modal para dar de alta una nueva lista.
   */
  public openCreateModal(): void {
    this.isEditing.set(false);
    this.currentPrctUuid.set(null);
    this.formCode.set('');
    this.formName.set('');
    this.formDescription.set('');
    this.formActive.set(true);
    this.formIsDefault.set(false);
    this.isFormOpen.set(true);
  }

  /**
   * Abre el modal para editar una lista existente.
   */
  public openEditModal(tier: PriceTierInterface): void {
    this.isEditing.set(true);
    this.currentPrctUuid.set(tier.prct_uuid);
    this.formCode.set(tier.prct_code || '');
    this.formName.set(tier.prct_name);
    this.formDescription.set(tier.prct_description || '');
    this.formActive.set(tier.prct_active !== false);
    this.formIsDefault.set(!!tier.prct_isdefault);
    this.isFormOpen.set(true);
  }

  public closeModal(): void {
    this.isFormOpen.set(false);
  }

  /**
   * Guarda o actualiza la lista de precios en la API.
   */
  public savePriceTier(): void {
    if (!this.formName().trim()) {
      this.errorMessage.set('El nombre de la lista de precios es obligatorio.');
      return;
    }

    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid || 'cmp-ats-001';
    this.isSaving.set(true);
    this.errorMessage.set(null);

    const payload: Partial<PriceTierInterface> = {
      cmp_uuid: cmpUuid,
      prct_code: this.formCode().trim().toUpperCase() || 'STD',
      prct_name: this.formName().trim(),
      prct_description: this.formDescription().trim() || null,
      prct_active: this.formActive(),
      prct_isdefault: this.formIsDefault()
    };

    if (this.isEditing() && this.currentPrctUuid()) {
      const prctUuid = this.currentPrctUuid()!;
      this._priceTierService.updatePriceTier(cmpUuid, prctUuid, payload).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.successMessage.set(`Lista de precios "${payload.prct_name}" actualizada con éxito.`);
          this.closeModal();
          this.loadData();
        },
        error: (err) => {
          this.isSaving.set(false);
          console.error('Error al actualizar lista de precios:', err);
          this.errorMessage.set(
            err.error?.error || err.error?.message || 'Error al actualizar la lista de precios.'
          );
        }
      });
    } else {
      this._priceTierService.savePriceTier(payload).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.successMessage.set(`Lista de precios "${payload.prct_name}" creada con éxito.`);
          this.closeModal();
          this.loadData();
        },
        error: (err) => {
          this.isSaving.set(false);
          console.error('Error al registrar lista de precios:', err);
          this.errorMessage.set(
            err.error?.error || err.error?.message || 'Error al crear la lista de precios.'
          );
        }
      });
    }
  }

  /**
   * Marca una lista de precios como la predeterminada de la empresa.
   */
  public setDefault(tier: PriceTierInterface): void {
    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid || 'cmp-ats-001';
    this._priceTierService.setDefaultPriceTier(cmpUuid, tier.prct_uuid).subscribe({
      next: () => {
        this.priceTiers.update((list) =>
          list.map((t) => ({
            ...t,
            prct_isdefault: t.prct_uuid === tier.prct_uuid
          }))
        );
        this.successMessage.set(`"${tier.prct_name}" ahora es la lista predeterminada.`);
      },
      error: (err) => {
        console.error('Error al marcar lista predeterminada:', err);
        this.errorMessage.set(
          err.error?.error || err.error?.message || 'No se pudo establecer como predeterminada.'
        );
      }
    });
  }

  /**
   * Activa o desactiva una lista de precios.
   */
  public toggleActive(tier: PriceTierInterface): void {
    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid || 'cmp-ats-001';
    const newStatus = !tier.prct_active;

    this._priceTierService
      .updatePriceTier(cmpUuid, tier.prct_uuid, { prct_active: newStatus })
      .subscribe({
        next: () => {
          this.priceTiers.update((list) =>
            list.map((t) => (t.prct_uuid === tier.prct_uuid ? { ...t, prct_active: newStatus } : t))
          );
          this.successMessage.set(
            `Lista "${tier.prct_name}" ${newStatus ? 'activada' : 'desactivada'}.`
          );
        },
        error: (err) => {
          console.error('Error al cambiar estado de lista:', err);
          this.errorMessage.set(
            err.error?.error || err.error?.message || 'No se pudo modificar el estado.'
          );
        }
      });
  }

  /**
   * Elimina una lista de precios.
   */
  public deletePriceTier(tier: PriceTierInterface): void {
    if (tier.prct_isdefault) {
      alert('No podés eliminar la lista de precios predeterminada de la empresa.');
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar la lista de precios "${tier.prct_name}"?`)) return;

    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid || 'cmp-ats-001';
    this._priceTierService.deletePriceTier(cmpUuid, tier.prct_uuid).subscribe({
      next: () => {
        this.priceTiers.update((list) => list.filter((t) => t.prct_uuid !== tier.prct_uuid));
        this.successMessage.set(`Lista "${tier.prct_name}" eliminada.`);
      },
      error: (err) => {
        console.error('Error al eliminar lista:', err);
        this.errorMessage.set(
          err.error?.error ||
            err.error?.message ||
            'No se pudo eliminar la lista de precios (puede tener clientes o productos asignados).'
        );
      }
    });
  }
}
