import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompaniesService } from '@services/companies';
import { CompanyInterface } from '@interfaces/company';

@Component({
  selector: 'app-companies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './companies.html',
  styleUrl: './companies.scss'
})
export class Companies implements OnInit {
  private readonly _companiesService = inject(CompaniesService);

  // Estados reactivos
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Datos y Filtros
  readonly companies = signal<CompanyInterface[]>([]);
  readonly searchQuery = signal<string>('');
  readonly filterStatus = signal<string>('all');

  // Estado del Modal de Alta/Edición
  readonly isModalOpen = signal<boolean>(false);
  readonly isEditing = signal<boolean>(false);
  readonly editingCmpUuid = signal<string | null>(null);

  // Campos del Formulario
  readonly formName = signal<string>('');
  readonly formAddress = signal<string>('');
  readonly formPhone = signal<string>('');
  readonly formEmail = signal<string>('');
  readonly formWhatsapp = signal<string>('');
  readonly formDescription = signal<string>('');
  readonly formPrimaryColor = signal<string>('#0f4c81');
  readonly formStatus = signal<string>('ACTIVE');

  // Modal de Confirmación de Baja
  readonly companyToDelete = signal<CompanyInterface | null>(null);

  // Computed KPIs
  readonly totalCompanies = computed<number>(() => this.companies().length);

  readonly activeCompaniesCount = computed<number>(() => {
    return this.companies().filter((c) => (c.cmp_status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length;
  });

  readonly inactiveCompaniesCount = computed<number>(() => {
    return this.companies().filter((c) => (c.cmp_status || '').toUpperCase() === 'INACTIVE').length;
  });

  // Empresas filtradas
  readonly filteredCompanies = computed<CompanyInterface[]>(() => {
    let result = this.companies();
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.filterStatus();

    if (status !== 'all') {
      result = result.filter((c) => {
        const cStatus = (c.cmp_status || 'ACTIVE').toUpperCase();
        return status === 'ACTIVE' ? cStatus !== 'INACTIVE' : cStatus === 'INACTIVE';
      });
    }

    if (query) {
      result = result.filter((c) => {
        const name = (c.cmp_name || '').toLowerCase();
        const email = (c.cmp_email || '').toLowerCase();
        const phone = (c.cmp_phone || '').toLowerCase();
        const uuid = (c.cmp_uuid || '').toLowerCase();
        return name.includes(query) || email.includes(query) || phone.includes(query) || uuid.includes(query);
      });
    }

    return result;
  });

  ngOnInit(): void {
    this.loadCompanies();
  }

  public loadCompanies(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._companiesService.getCompanies().subscribe({
      next: (res: any) => {
        this.isLoading.set(false);
        const list = Array.isArray(res) ? res : res?.data || [];
        this.companies.set(list);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('No se pudo recuperar el listado de empresas.');
        console.error('Error al cargar empresas:', err);
      }
    });
  }

  public openCreateModal(): void {
    this.isEditing.set(false);
    this.editingCmpUuid.set(null);
    this.formName.set('');
    this.formAddress.set('');
    this.formPhone.set('');
    this.formEmail.set('');
    this.formWhatsapp.set('');
    this.formDescription.set('');
    this.formPrimaryColor.set('#0f4c81');
    this.formStatus.set('ACTIVE');
    this.isModalOpen.set(true);
  }

  public openEditModal(company: CompanyInterface): void {
    this.isEditing.set(true);
    this.editingCmpUuid.set(company.cmp_uuid);
    this.formName.set(company.cmp_name || '');
    this.formAddress.set(company.cmp_address || '');
    this.formPhone.set(company.cmp_phone || '');
    this.formEmail.set(company.cmp_email || '');
    this.formWhatsapp.set(company.cmp_whatsapp || '');
    this.formDescription.set(company.cmp_description || '');
    this.formPrimaryColor.set(company.cmp_primarycolor || '#0f4c81');
    this.formStatus.set(company.cmp_status || 'ACTIVE');
    this.isModalOpen.set(true);
  }

  public closeModal(): void {
    this.isModalOpen.set(false);
  }

  public submitCompany(): void {
    const name = this.formName().trim();
    if (!name) {
      this.errorMessage.set('La Razón Social o Nombre de la Empresa es obligatorio.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const payload: Partial<CompanyInterface> = {
      cmp_name: name,
      cmp_address: this.formAddress().trim() || null,
      cmp_phone: this.formPhone().trim() || null,
      cmp_email: this.formEmail().trim() || null,
      cmp_whatsapp: this.formWhatsapp().trim() || null,
      cmp_description: this.formDescription().trim() || null,
      cmp_primarycolor: this.formPrimaryColor().trim() || null,
      cmp_status: this.formStatus()
    };

    if (this.isEditing() && this.editingCmpUuid()) {
      const cmp_uuid = this.editingCmpUuid()!;
      this._companiesService.updateCompany(cmp_uuid, payload).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.isModalOpen.set(false);
          this.successMessage.set(`Empresa ${name} actualizada exitosamente.`);
          this.loadCompanies();
          setTimeout(() => this.successMessage.set(null), 3500);
        },
        error: (err) => {
          this.isSaving.set(false);
          this.errorMessage.set(err?.error?.message || 'Error al actualizar la empresa.');
          console.error('Error al actualizar empresa:', err);
        }
      });
    } else {
      this._companiesService.saveCompany(payload).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.isModalOpen.set(false);
          this.successMessage.set(`Empresa ${name} registrada exitosamente.`);
          this.loadCompanies();
          setTimeout(() => this.successMessage.set(null), 3500);
        },
        error: (err) => {
          this.isSaving.set(false);
          this.errorMessage.set(err?.error?.message || 'Error al registrar la empresa.');
          console.error('Error al crear empresa:', err);
        }
      });
    }
  }

  public toggleCompanyStatus(company: CompanyInterface): void {
    const current = (company.cmp_status || 'ACTIVE').toUpperCase();
    const newStatus = current === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';

    this.isSaving.set(true);
    this._companiesService.updateCompany(company.cmp_uuid, { cmp_status: newStatus }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.successMessage.set(`Estado de ${company.cmp_name} actualizado a ${newStatus}.`);
        this.loadCompanies();
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.message || 'Error al cambiar estado de la empresa.');
      }
    });
  }

  public confirmDelete(company: CompanyInterface): void {
    this.companyToDelete.set(company);
  }

  public cancelDelete(): void {
    this.companyToDelete.set(null);
  }

  public executeDelete(): void {
    const company = this.companyToDelete();
    if (!company?.cmp_uuid) return;

    this.isSaving.set(true);
    this._companiesService.deleteCompany(company.cmp_uuid).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.companyToDelete.set(null);
        this.successMessage.set(`Empresa ${company.cmp_name} eliminada.`);
        this.loadCompanies();
        setTimeout(() => this.successMessage.set(null), 3500);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.companyToDelete.set(null);
        this.errorMessage.set(err?.error?.message || 'Error al eliminar la empresa.');
      }
    });
  }

  public getCompanyInitials(name?: string): string {
    if (!name) return 'CO';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
}
