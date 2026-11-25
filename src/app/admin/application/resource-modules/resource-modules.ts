import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ResourceModulesService } from '@services/resource-modules';
import { ResourceTypesService } from '@services/resource-types';
import { ResourceModuleInterface } from '@interfaces/resource-module';
import { ResourceTypeInterface } from '@interfaces/resource-type';

@Component({
  selector: 'app-resource-modules',
  imports: [CommonModule, FormsModule],
  templateUrl: './resource-modules.html',
  styleUrl: './resource-modules.scss',
})
export class ResourceModules implements OnInit {
  private resourceModulesService = inject(ResourceModulesService);
  private resourceTypesService = inject(ResourceTypesService);

  // Tab activo ('MODULES' | 'TYPES')
  activeTab = signal<'MODULES' | 'TYPES'>('MODULES');

  // Datos reactivos
  modules = signal<ResourceModuleInterface[]>([]);
  types = signal<ResourceTypeInterface[]>([]);
  searchTerm = signal<string>('');

  // Estados de carga y feedback
  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Modal Módulo (Crear / Editar)
  isModuleModalOpen = signal<boolean>(false);
  isEditingModule = signal<boolean>(false);
  moduleForm = signal<{
    remo_uuid?: string;
    remo_name: string;
    remo_description: string;
  }>({
    remo_name: '',
    remo_description: '',
  });

  // Modal Tipo de Recurso (Crear / Editar)
  isTypeModalOpen = signal<boolean>(false);
  isEditingType = signal<boolean>(false);
  typeForm = signal<{
    rety_uuid?: string;
    rety_name: string;
    rety_description: string;
  }>({
    rety_name: '',
    rety_description: '',
  });

  // Modal Confirmación Eliminar
  isDeleteModalOpen = signal<boolean>(false);
  itemToDelete = signal<{ type: 'MODULE' | 'TYPE'; id: string; name: string } | null>(null);

  // Módulos filtrados
  filteredModules = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const list = this.modules();
    if (!term) return list;
    return list.filter(
      (m) =>
        m.remo_name.toLowerCase().includes(term) ||
        (m.remo_description && m.remo_description.toLowerCase().includes(term))
    );
  });

  // Tipos filtrados
  filteredTypes = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const list = this.types();
    if (!term) return list;
    return list.filter(
      (t) =>
        t.rety_name.toLowerCase().includes(term) ||
        (t.rety_description && t.rety_description.toLowerCase().includes(term))
    );
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      modules: this.resourceModulesService.getResourceModules(),
      types: this.resourceTypesService.getResourceTypes(),
    }).subscribe({
      next: ({ modules, types }) => {
        this.modules.set(modules.data || []);
        this.types.set(types.data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set('Error al cargar la lista de módulos y tipos de recursos.');
        this.isLoading.set(false);
      },
    });
  }

  // --- GESTIÓN DE MÓDULOS ---
  openCreateModuleModal(): void {
    this.isEditingModule.set(false);
    this.moduleForm.set({ remo_name: '', remo_description: '' });
    this.isModuleModalOpen.set(true);
  }

  openEditModuleModal(item: ResourceModuleInterface): void {
    this.isEditingModule.set(true);
    this.moduleForm.set({
      remo_uuid: item.remo_uuid,
      remo_name: item.remo_name,
      remo_description: item.remo_description || '',
    });
    this.isModuleModalOpen.set(true);
  }

  closeModuleModal(): void {
    this.isModuleModalOpen.set(false);
  }

  saveModule(): void {
    const form = this.moduleForm();
    if (!form.remo_name.trim()) {
      this.errorMessage.set('El nombre del módulo de recurso es obligatorio.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const payload = {
      remo_name: form.remo_name.trim(),
      remo_description: form.remo_description.trim() || '',
    };

    if (this.isEditingModule() && form.remo_uuid) {
      this.resourceModulesService.updateResourceModule(form.remo_uuid, payload).subscribe({
        next: () => {
          this.successMessage.set(`Módulo "${form.remo_name}" actualizado con éxito.`);
          this.isSaving.set(false);
          this.closeModuleModal();
          this.loadData();
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message || 'Error al actualizar módulo.');
          this.isSaving.set(false);
        },
      });
    } else {
      this.resourceModulesService.saveResourceModule(payload).subscribe({
        next: () => {
          this.successMessage.set(`Módulo "${form.remo_name}" creado con éxito.`);
          this.isSaving.set(false);
          this.closeModuleModal();
          this.loadData();
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message || 'Error al crear módulo.');
          this.isSaving.set(false);
        },
      });
    }
  }

  // --- GESTIÓN DE TIPOS DE RECURSOS ---
  openCreateTypeModal(): void {
    this.isEditingType.set(false);
    this.typeForm.set({ rety_name: '', rety_description: '' });
    this.isTypeModalOpen.set(true);
  }

  openEditTypeModal(item: ResourceTypeInterface): void {
    this.isEditingType.set(true);
    this.typeForm.set({
      rety_uuid: item.rety_uuid,
      rety_name: item.rety_name,
      rety_description: item.rety_description || '',
    });
    this.isTypeModalOpen.set(true);
  }

  closeTypeModal(): void {
    this.isTypeModalOpen.set(false);
  }

  saveType(): void {
    const form = this.typeForm();
    if (!form.rety_name.trim()) {
      this.errorMessage.set('El nombre del tipo de recurso es obligatorio.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const payload = {
      rety_name: form.rety_name.trim(),
      rety_description: form.rety_description.trim() || null,
    };

    if (this.isEditingType() && form.rety_uuid) {
      this.resourceTypesService.updateResourceType(form.rety_uuid, payload).subscribe({
        next: () => {
          this.successMessage.set(`Tipo de recurso "${form.rety_name}" actualizado.`);
          this.isSaving.set(false);
          this.closeTypeModal();
          this.loadData();
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message || 'Error al actualizar tipo de recurso.');
          this.isSaving.set(false);
        },
      });
    } else {
      this.resourceTypesService.saveResourceType(payload).subscribe({
        next: () => {
          this.successMessage.set(`Tipo de recurso "${form.rety_name}" creado con éxito.`);
          this.isSaving.set(false);
          this.closeTypeModal();
          this.loadData();
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message || 'Error al crear tipo de recurso.');
          this.isSaving.set(false);
        },
      });
    }
  }

  // --- ELIMINACIÓN GENERAL ---
  openDeleteModal(type: 'MODULE' | 'TYPE', id: string, name: string): void {
    this.itemToDelete.set({ type, id, name });
    this.isDeleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.isDeleteModalOpen.set(false);
    this.itemToDelete.set(null);
  }

  confirmDelete(): void {
    const item = this.itemToDelete();
    if (!item) return;

    this.isSaving.set(true);
    if (item.type === 'MODULE') {
      this.resourceModulesService.deleteResourceModule(item.id).subscribe({
        next: () => {
          this.successMessage.set(`Módulo "${item.name}" eliminado.`);
          this.isSaving.set(false);
          this.closeDeleteModal();
          this.loadData();
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message || 'Error al eliminar módulo.');
          this.isSaving.set(false);
        },
      });
    } else {
      this.resourceTypesService.deleteResourceType(item.id).subscribe({
        next: () => {
          this.successMessage.set(`Tipo de recurso "${item.name}" eliminado.`);
          this.isSaving.set(false);
          this.closeDeleteModal();
          this.loadData();
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message || 'Error al eliminar tipo de recurso.');
          this.isSaving.set(false);
        },
      });
    }
  }
}
