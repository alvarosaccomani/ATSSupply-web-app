import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompaniesService } from '@services/companies';
import { CompanySettingsService } from '@services/company-settings';
import { CompanyInterface } from '@interfaces/company';
import { CompanySettingInterface } from '@interfaces/company-setting';

@Component({
  selector: 'app-company-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './company-settings.html',
  styleUrl: './company-settings.scss',
})
export class CompanySettings implements OnInit {
  private companiesService = inject(CompaniesService);
  private companySettingsService = inject(CompanySettingsService);

  // Estados reactivos con Signals
  companies = signal<CompanyInterface[]>([]);
  selectedCompanyUuid = signal<string>('');
  settings = signal<CompanySettingInterface[]>([]);
  searchTerm = signal<string>('');
  selectedGroupFilter = signal<string>('ALL');

  isLoadingCompanies = signal<boolean>(false);
  isLoadingSettings = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Modal Crear / Editar
  isModalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  formData = signal<{
    cmps_uuid?: string;
    cmps_key: string;
    cmps_parameter: string;
    cmps_description: string;
    cmps_value: string;
    cmps_datatype: string;
    cmps_options: string;
    cmps_group: string;
  }>({
    cmps_key: '',
    cmps_parameter: '',
    cmps_description: '',
    cmps_value: '',
    cmps_datatype: 'string',
    cmps_options: '',
    cmps_group: 'GENERAL',
  });

  // Modal Confirmación Eliminar
  isDeleteModalOpen = signal<boolean>(false);
  settingToDelete = signal<CompanySettingInterface | null>(null);

  // Lista de grupos conocidos / sugeridos
  predefinedGroups = ['GENERAL', 'FACTURACION', 'OPERACIONES', 'IMPRESION', 'NOTIFICACIONES', 'SEGURIDAD'];
  dataTypes = ['string', 'number', 'boolean', 'json'];

  // Grupos computados disponibles a partir de los settings
  availableGroups = computed(() => {
    const list = this.settings();
    const groupsSet = new Set<string>();
    list.forEach((s) => {
      if (s.cmps_group) {
        groupsSet.add(s.cmps_group.toUpperCase());
      }
    });
    return Array.from(groupsSet).sort();
  });

  // Settings filtrados por término de búsqueda y grupo
  filteredSettings = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const groupFilter = this.selectedGroupFilter();

    return this.settings().filter((s) => {
      const matchesGroup =
        groupFilter === 'ALL' ||
        (s.cmps_group || 'GENERAL').toUpperCase() === groupFilter.toUpperCase();

      const matchesTerm =
        !term ||
        s.cmps_key.toLowerCase().includes(term) ||
        s.cmps_parameter.toLowerCase().includes(term) ||
        (s.cmps_description && s.cmps_description.toLowerCase().includes(term)) ||
        (s.cmps_value && s.cmps_value.toLowerCase().includes(term));

      return matchesGroup && matchesTerm;
    });
  });

  // Diccionario de settings agrupados para renderizado por tarjetas
  groupedSettings = computed(() => {
    const list = this.filteredSettings();
    const groups: { [key: string]: CompanySettingInterface[] } = {};

    list.forEach((item) => {
      const g = (item.cmps_group || 'GENERAL').toUpperCase();
      if (!groups[g]) {
        groups[g] = [];
      }
      groups[g].push(item);
    });

    return groups;
  });

  groupedKeys = computed(() => Object.keys(this.groupedSettings()).sort());

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(): void {
    this.isLoadingCompanies.set(true);
    this.errorMessage.set(null);
    this.companiesService.getCompanies().subscribe({
      next: (res) => {
        const list = (res.data || []) as CompanyInterface[];
        const active = list.filter((c) => c.cmp_status !== 'INACTIVE');
        this.companies.set(active);
        if (active.length > 0) {
          this.selectedCompanyUuid.set(active[0].cmp_uuid);
          this.loadSettings();
        }
        this.isLoadingCompanies.set(false);
      },
      error: (err) => {
        this.errorMessage.set('Error al cargar la lista de empresas.');
        this.isLoadingCompanies.set(false);
      },
    });
  }

  onCompanyChange(cmpUuid: string): void {
    this.selectedCompanyUuid.set(cmpUuid);
    this.loadSettings();
  }

  loadSettings(): void {
    const cmpUuid = this.selectedCompanyUuid();
    if (!cmpUuid) return;

    this.isLoadingSettings.set(true);
    this.errorMessage.set(null);

    this.companySettingsService.getCompanySettings(cmpUuid).subscribe({
      next: (res) => {
        this.settings.set(res.data || []);
        this.isLoadingSettings.set(false);
      },
      error: (err) => {
        this.errorMessage.set('Error al cargar las configuraciones de la empresa.');
        this.isLoadingSettings.set(false);
      },
    });
  }

  openCreateModal(): void {
    this.isEditing.set(false);
    this.formData.set({
      cmps_key: '',
      cmps_parameter: '',
      cmps_description: '',
      cmps_value: '',
      cmps_datatype: 'string',
      cmps_options: '',
      cmps_group: 'GENERAL',
    });
    this.isModalOpen.set(true);
  }

  openEditModal(setting: CompanySettingInterface): void {
    this.isEditing.set(true);
    this.formData.set({
      cmps_uuid: setting.cmps_uuid,
      cmps_key: setting.cmps_key,
      cmps_parameter: setting.cmps_parameter,
      cmps_description: setting.cmps_description || '',
      cmps_value: setting.cmps_value || '',
      cmps_datatype: setting.cmps_datatype || 'string',
      cmps_options: setting.cmps_options || '',
      cmps_group: (setting.cmps_group || 'GENERAL').toUpperCase(),
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  saveSetting(): void {
    const form = this.formData();
    const cmpUuid = this.selectedCompanyUuid();

    if (!cmpUuid) {
      this.errorMessage.set('Debe seleccionar una empresa válida.');
      return;
    }

    if (!form.cmps_key.trim() || !form.cmps_parameter.trim()) {
      this.errorMessage.set('La clave (key) y el nombre de parámetro son requeridos.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.isEditing() && form.cmps_uuid) {
      this.companySettingsService
        .updateCompanySetting(cmpUuid, form.cmps_uuid, {
          cmps_key: form.cmps_key.trim(),
          cmps_parameter: form.cmps_parameter.trim(),
          cmps_description: form.cmps_description.trim() || null,
          cmps_value: form.cmps_value,
          cmps_datatype: form.cmps_datatype,
          cmps_options: form.cmps_options.trim() || null,
          cmps_group: form.cmps_group.trim().toUpperCase() || 'GENERAL',
        })
        .subscribe({
          next: () => {
            this.successMessage.set('Configuración actualizada con éxito.');
            this.isSaving.set(false);
            this.closeModal();
            this.loadSettings();
          },
          error: (err) => {
            this.errorMessage.set(err?.error?.message || 'Error al actualizar configuración.');
            this.isSaving.set(false);
          },
        });
    } else {
      this.companySettingsService
        .saveCompanySetting({
          cmp_uuid: cmpUuid,
          cmps_key: form.cmps_key.trim(),
          cmps_parameter: form.cmps_parameter.trim(),
          cmps_description: form.cmps_description.trim() || null,
          cmps_value: form.cmps_value,
          cmps_datatype: form.cmps_datatype,
          cmps_options: form.cmps_options.trim() || null,
          cmps_group: form.cmps_group.trim().toUpperCase() || 'GENERAL',
        })
        .subscribe({
          next: () => {
            this.successMessage.set('Configuración creada con éxito.');
            this.isSaving.set(false);
            this.closeModal();
            this.loadSettings();
          },
          error: (err) => {
            this.errorMessage.set(err?.error?.message || 'Error al crear la configuración.');
            this.isSaving.set(false);
          },
        });
    }
  }

  // Toggle rápido para valores booleanos en tabla
  toggleBooleanValue(setting: CompanySettingInterface): void {
    const cmpUuid = this.selectedCompanyUuid();
    if (!cmpUuid) return;

    const currentVal = setting.cmps_value === 'true' || setting.cmps_value === '1';
    const nextVal = (!currentVal).toString();

    this.companySettingsService
      .updateCompanySetting(cmpUuid, setting.cmps_uuid, {
        cmps_value: nextVal,
      })
      .subscribe({
        next: () => {
          this.loadSettings();
        },
        error: (err) => {
          this.errorMessage.set('Error al conmutar el valor del parámetro.');
        },
      });
  }

  openDeleteModal(setting: CompanySettingInterface): void {
    this.settingToDelete.set(setting);
    this.isDeleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.isDeleteModalOpen.set(false);
    this.settingToDelete.set(null);
  }

  confirmDelete(): void {
    const setting = this.settingToDelete();
    const cmpUuid = this.selectedCompanyUuid();

    if (!setting || !cmpUuid) return;

    this.isSaving.set(true);
    this.companySettingsService.deleteCompanySetting(cmpUuid, setting.cmps_uuid).subscribe({
      next: () => {
        this.successMessage.set(`Parámetro "${setting.cmps_parameter}" eliminado.`);
        this.isSaving.set(false);
        this.closeDeleteModal();
        this.loadSettings();
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error al eliminar el parámetro.');
        this.isSaving.set(false);
      },
    });
  }
}
