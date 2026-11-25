import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RolesService } from '@services/roles';
import { PermissionsService } from '@services/permissions';
import { RolesPermissionsService } from '@services/roles-permissions';
import { RolInterface } from '@interfaces/rol';
import { PermissionInterface } from '@interfaces/permission';

export interface GroupedPermissions {
  moduleName: string;
  items: PermissionInterface[];
}

@Component({
  selector: 'app-roles-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './roles-permissions.html',
  styleUrl: './roles-permissions.scss'
})
export class RolesPermissions implements OnInit {
  private readonly _rolesService = inject(RolesService);
  private readonly _permissionsService = inject(PermissionsService);
  private readonly _rolesPermissionsService = inject(RolesPermissionsService);

  // Estados reactivos
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Listas de datos
  readonly roles = signal<RolInterface[]>([]);
  readonly selectedRolUuid = signal<string>('');
  readonly permissions = signal<PermissionInterface[]>([]);

  // Asignaciones para el rol seleccionado (IDs de permisos asignados)
  readonly selectedPermissionUuids = signal<string[]>([]);
  readonly initialPermissionUuids = signal<string[]>([]);

  // Filtros de búsqueda
  readonly searchQuery = signal<string>('');
  readonly selectedModuleFilter = signal<string>('all');

  // Rol actualmente seleccionado
  readonly selectedRol = computed<RolInterface | undefined>(() => {
    const uuid = this.selectedRolUuid();
    return this.roles().find((r) => r.rol_uuid === uuid);
  });

  // Conjunto para verificación rápida O(1) de permisos asignados
  readonly assignedSet = computed<Set<string>>(() => {
    return new Set(this.selectedPermissionUuids());
  });

  // Detecta si hay cambios sin guardar
  readonly hasUnsavedChanges = computed<boolean>(() => {
    const current = new Set(this.selectedPermissionUuids());
    const initial = new Set(this.initialPermissionUuids());

    if (current.size !== initial.size) return true;
    for (const id of current) {
      if (!initial.has(id)) return true;
    }
    return false;
  });

  // Total de permisos asignados al rol activo
  readonly assignedCount = computed<number>(() => {
    return this.selectedPermissionUuids().length;
  });

  // Permisos filtrados por query de búsqueda y módulo
  readonly filteredPermissions = computed<PermissionInterface[]>(() => {
    let result = this.permissions();
    const query = this.searchQuery().trim().toLowerCase();
    const mod = this.selectedModuleFilter();

    if (mod !== 'all') {
      result = result.filter((p) => this.getPermissionModule(p.per_slug) === mod);
    }

    if (query) {
      result = result.filter((p) => {
        const slug = (p.per_slug || '').toLowerCase();
        const desc = (p.per_description || '').toLowerCase();
        return slug.includes(query) || desc.includes(query);
      });
    }

    return result;
  });

  // Lista de módulos únicos para el filtro
  readonly availableModules = computed<string[]>(() => {
    const set = new Set<string>();
    for (const p of this.permissions()) {
      set.add(this.getPermissionModule(p.per_slug));
    }
    return Array.from(set).sort();
  });

  // Permisos agrupados por módulo
  readonly groupedPermissions = computed<GroupedPermissions[]>(() => {
    const map = new Map<string, PermissionInterface[]>();

    for (const p of this.filteredPermissions()) {
      const mod = this.getPermissionModule(p.per_slug);
      if (!map.has(mod)) {
        map.set(mod, []);
      }
      map.get(mod)!.push(p);
    }

    const groups: GroupedPermissions[] = [];
    for (const [moduleName, items] of map.entries()) {
      groups.push({ moduleName, items });
    }

    return groups.sort((a, b) => a.moduleName.localeCompare(b.moduleName));
  });

  ngOnInit(): void {
    this.loadRoles();
    this.loadPermissionsCatalog();
  }

  public loadRoles(): void {
    this._rolesService.getRoles().subscribe({
      next: (res) => {
        const list = res?.data || [];
        this.roles.set(list);

        if (list.length > 0 && !this.selectedRolUuid()) {
          this.selectRole(list[0].rol_uuid);
        }
      },
      error: (err) => {
        console.error('Error al cargar roles:', err);
        this.errorMessage.set('No se pudo cargar la lista de roles.');
      }
    });
  }

  public loadPermissionsCatalog(): void {
    this._permissionsService.getPermissions().subscribe({
      next: (res: any) => {
        const list: PermissionInterface[] = Array.isArray(res) ? res : res?.data || [];
        this.permissions.set(list);
      },
      error: (err) => {
        console.error('Error al cargar catálogo de permisos:', err);
        this.errorMessage.set('No se pudo cargar el catálogo de permisos.');
      }
    });
  }

  public selectRole(rol_uuid: string): void {
    this.selectedRolUuid.set(rol_uuid);
    this.loadRolePermissions(rol_uuid);
  }

  public loadRolePermissions(rol_uuid: string): void {
    if (!rol_uuid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._rolesPermissionsService.getPermissionsByRol(rol_uuid).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const data = res?.data || [];
        const perUuids = data.map((rp) => rp.per_uuid);
        this.selectedPermissionUuids.set(perUuids);
        this.initialPermissionUuids.set([...perUuids]);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('Error al cargar los permisos asignados al rol.');
        console.error('Error al obtener permisos del rol:', err);
      }
    });
  }

  public togglePermission(per_uuid: string): void {
    const current = new Set(this.selectedPermissionUuids());
    if (current.has(per_uuid)) {
      current.delete(per_uuid);
    } else {
      current.add(per_uuid);
    }
    this.selectedPermissionUuids.set(Array.from(current));
  }

  public isPermissionAssigned(per_uuid: string): boolean {
    return this.assignedSet().has(per_uuid);
  }

  public selectAllFiltered(): void {
    const current = new Set(this.selectedPermissionUuids());
    for (const p of this.filteredPermissions()) {
      current.add(p.per_uuid);
    }
    this.selectedPermissionUuids.set(Array.from(current));
  }

  public deselectAllFiltered(): void {
    const current = new Set(this.selectedPermissionUuids());
    for (const p of this.filteredPermissions()) {
      current.delete(p.per_uuid);
    }
    this.selectedPermissionUuids.set(Array.from(current));
  }

  public selectAllInGroup(group: GroupedPermissions): void {
    const current = new Set(this.selectedPermissionUuids());
    for (const p of group.items) {
      current.add(p.per_uuid);
    }
    this.selectedPermissionUuids.set(Array.from(current));
  }

  public deselectAllInGroup(group: GroupedPermissions): void {
    const current = new Set(this.selectedPermissionUuids());
    for (const p of group.items) {
      current.delete(p.per_uuid);
    }
    this.selectedPermissionUuids.set(Array.from(current));
  }

  public isGroupFullyAssigned(group: GroupedPermissions): boolean {
    const assigned = this.assignedSet();
    return group.items.length > 0 && group.items.every((p) => assigned.has(p.per_uuid));
  }

  public saveRolePermissions(): void {
    const rol_uuid = this.selectedRolUuid();
    if (!rol_uuid) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const per_uuids = this.selectedPermissionUuids();

    this._rolesPermissionsService.syncPermissionsToRol(rol_uuid, per_uuids).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.initialPermissionUuids.set([...per_uuids]);
        this.successMessage.set(
          `Matriz de permisos para ${this.selectedRol()?.rol_name || 'el rol'} guardada exitosamente.`
        );
        setTimeout(() => this.successMessage.set(null), 3500);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.message || 'Error al guardar la asignación de permisos.');
        console.error('Error al sincronizar permisos:', err);
      }
    });
  }

  public resetChanges(): void {
    this.selectedPermissionUuids.set([...this.initialPermissionUuids()]);
  }

  public getPermissionModule(slug?: string): string {
    if (!slug) return 'GENERAL';
    const clean = slug.toUpperCase();
    if (clean.includes(':')) {
      return clean.split(':')[0].trim();
    }
    if (clean.includes('_')) {
      return clean.split('_')[0].trim();
    }
    return 'GENERAL';
  }

  public getRoleBadgeClass(roleName?: string): string {
    const name = (roleName || '').toUpperCase();
    if (name.includes('DUEÑO') || name.includes('OWNER') || name.includes('ADMIN')) {
      return 'bg-danger-subtle text-danger border-danger-subtle';
    }
    if (name.includes('VENDEDOR') || name.includes('SELLER') || name.includes('VENTAS')) {
      return 'bg-success-subtle text-success border-success-subtle';
    }
    if (name.includes('CHOFER') || name.includes('DRIVER') || name.includes('REPARTO')) {
      return 'bg-warning-subtle text-warning-emphasis border-warning-subtle';
    }
    if (name.includes('OPERARIO') || name.includes('PRODUCCION')) {
      return 'bg-info-subtle text-info-emphasis border-info-subtle';
    }
    return 'bg-secondary-subtle text-secondary border-secondary-subtle';
  }
}
