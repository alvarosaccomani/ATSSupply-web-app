import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompanyContextService } from '@services/company-context';
import { MachineService } from '@services/machines';
import { MachineInterface } from '@interfaces/machine';

@Component({
  selector: 'app-machines',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './machines.html',
  styleUrl: './machines.scss'
})
export class Machines implements OnInit {
  private readonly _companyContext = inject(CompanyContextService);
  private readonly _machineService = inject(MachineService);

  // Estados de carga y feedback
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  // Listado
  readonly machines = signal<MachineInterface[]>([]);
  readonly searchQuery = signal<string>('');

  // Modal y Formulario
  readonly isFormOpen = signal<boolean>(false);
  readonly isEditing = signal<boolean>(false);
  readonly currentMchUuid = signal<string | null>(null);

  readonly formName = signal<string>('');
  readonly formDescription = signal<string>('');
  readonly formDailyCapacity = signal<number | null>(null);
  readonly formActive = signal<boolean>(true);

  // Computed: filtrado reactivo
  readonly filteredMachines = computed<MachineInterface[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.machines();
    if (!query) return list;
    return list.filter(
      (m) =>
        m.mch_name.toLowerCase().includes(query) ||
        (m.mch_description && m.mch_description.toLowerCase().includes(query))
    );
  });

  // Métricas computadas
  readonly totalActiveMachines = computed<number>(
    () => this.machines().filter((m) => m.mch_active !== false).length
  );

  readonly totalNominalCapacity = computed<number>(() =>
    this.machines()
      .filter((m) => m.mch_active !== false)
      .reduce((acc, m) => acc + (m.mch_dailycapacity || 0), 0)
  );

  public ngOnInit(): void {
    this.loadData();
  }

  /**
   * Carga las máquinas desde la API.
   */
  public loadData(): void {
    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid || 'cmp-ats-001';
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._machineService.getMachines(cmpUuid).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        this.machines.set(list);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar máquinas:', err);
        this.errorMessage.set('No se pudieron recuperar las máquinas de producción.');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Abre el modal para dar de alta una nueva máquina.
   */
  public openCreateModal(): void {
    this.isEditing.set(false);
    this.currentMchUuid.set(null);
    this.formName.set('');
    this.formDescription.set('');
    this.formDailyCapacity.set(null);
    this.formActive.set(true);
    this.isFormOpen.set(true);
  }

  /**
   * Abre el modal para editar una máquina existente.
   */
  public openEditModal(machine: MachineInterface): void {
    this.isEditing.set(true);
    this.currentMchUuid.set(machine.mch_uuid);
    this.formName.set(machine.mch_name);
    this.formDescription.set(machine.mch_description || '');
    this.formDailyCapacity.set(machine.mch_dailycapacity || null);
    this.formActive.set(machine.mch_active !== false);
    this.isFormOpen.set(true);
  }

  public closeModal(): void {
    this.isFormOpen.set(false);
  }

  /**
   * Guarda o actualiza la máquina en la API.
   */
  public saveMachine(): void {
    if (!this.formName().trim()) {
      this.errorMessage.set('El nombre de la máquina o línea es obligatorio.');
      return;
    }

    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid || 'cmp-ats-001';
    this.isSaving.set(true);
    this.errorMessage.set(null);

    const payload: Partial<MachineInterface> = {
      cmp_uuid: cmpUuid,
      mch_name: this.formName().trim(),
      mch_description: this.formDescription().trim() || null,
      mch_dailycapacity: this.formDailyCapacity() ? Number(this.formDailyCapacity()) : null,
      mch_active: this.formActive()
    };

    if (this.isEditing() && this.currentMchUuid()) {
      const mchUuid = this.currentMchUuid()!;
      this._machineService.updateMachine(cmpUuid, mchUuid, payload).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.successMessage.set(`Máquina "${payload.mch_name}" actualizada con éxito.`);
          this.closeModal();
          this.loadData();
        },
        error: (err) => {
          this.isSaving.set(false);
          console.error('Error al actualizar máquina:', err);
          this.errorMessage.set(
            err.error?.error || err.error?.message || 'Error al actualizar la máquina.'
          );
        }
      });
    } else {
      this._machineService.saveMachine(payload).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.successMessage.set(`Máquina "${payload.mch_name}" registrada con éxito.`);
          this.closeModal();
          this.loadData();
        },
        error: (err) => {
          this.isSaving.set(false);
          console.error('Error al registrar máquina:', err);
          this.errorMessage.set(
            err.error?.error || err.error?.message || 'Error al registrar la máquina.'
          );
        }
      });
    }
  }

  /**
   * Activa o desactiva una máquina.
   */
  public toggleActive(machine: MachineInterface): void {
    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid || 'cmp-ats-001';
    const newStatus = !machine.mch_active;

    this._machineService
      .updateMachine(cmpUuid, machine.mch_uuid, { mch_active: newStatus })
      .subscribe({
        next: () => {
          this.machines.update((list) =>
            list.map((m) => (m.mch_uuid === machine.mch_uuid ? { ...m, mch_active: newStatus } : m))
          );
          this.successMessage.set(
            `Máquina "${machine.mch_name}" ${newStatus ? 'activada' : 'puesta fuera de servicio'}.`
          );
        },
        error: (err) => {
          console.error('Error al cambiar estado de máquina:', err);
          this.errorMessage.set(
            err.error?.error || err.error?.message || 'No se pudo modificar el estado de la máquina.'
          );
        }
      });
  }

  /**
   * Elimina una máquina.
   */
  public deleteMachine(machine: MachineInterface): void {
    if (!confirm(`¿Estás seguro de eliminar la máquina "${machine.mch_name}"?`)) return;

    const cmpUuid = this._companyContext.activeCompany()?.cmp_uuid || 'cmp-ats-001';
    this._machineService.deleteMachine(cmpUuid, machine.mch_uuid).subscribe({
      next: () => {
        this.machines.update((list) => list.filter((m) => m.mch_uuid !== machine.mch_uuid));
        this.successMessage.set(`Máquina "${machine.mch_name}" eliminada.`);
      },
      error: (err) => {
        console.error('Error al eliminar máquina:', err);
        this.errorMessage.set(
          err.error?.error ||
            err.error?.message ||
            'No se pudo eliminar la máquina (puede tener partes de producción asociados).'
        );
      }
    });
  }
}
