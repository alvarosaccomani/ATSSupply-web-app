import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { CompanyInterface } from '@interfaces/company';
import { UserRolCompanyInterface, UserRolCompanyResultsInterface } from '@interfaces/user-rol-company';
import { UserRolesCompanyService } from './user-roles-company';

export type UserRole = 'OWNER' | 'SELLER' | 'DRIVER';

const STORAGE_KEYS = {
  ACTIVE_COMPANY: 'ats_active_company',
  USER_ROLES: 'ats_user_roles',
  ACTIVE_ROLE_UUID: 'ats_active_role_uuid'
} as const;

@Injectable({
  providedIn: 'root'
})
export class CompanyContextService {
  private readonly _userRolesCompanyService = inject(UserRolesCompanyService);

  // Estado base reactivo
  readonly companies = signal<CompanyInterface[]>([]);
  readonly activeCompany = signal<CompanyInterface | null>(this.loadStoredCompany());
  readonly userRoles = signal<UserRolCompanyInterface[]>(this.loadStoredUserRoles());
  readonly activeRoleUuid = signal<string | null>(this.loadStoredActiveRoleUuid());

  // Roles reales del usuario en la compañía activa
  readonly activeCompanyRoles = computed<UserRolCompanyInterface[]>(() => {
    const company = this.activeCompany();
    if (!company) return [];
    return this.userRoles().filter((r) => r.cmp_uuid === company.cmp_uuid);
  });

  // Asignación de rol activa en la compañía
  readonly currentRoleAssignment = computed<UserRolCompanyInterface | null>(() => {
    const roles = this.activeCompanyRoles();
    if (roles.length === 0) return null;
    const selectedUuid = this.activeRoleUuid();
    return roles.find((r) => r.rol_uuid === selectedUuid) ?? roles[0];
  });

  // Feature flags de módulos operativos
  readonly hasProduction = signal<boolean>(true);
  readonly hasSales = signal<boolean>(true);

  // Rol operativo derivado de la asignación real ('OWNER' | 'SELLER' | 'DRIVER')
  readonly activeRole = computed<UserRole>(() => {
    const assignment = this.currentRoleAssignment();
    if (!assignment) return 'OWNER';
    const rolName = assignment.rol_name || (assignment as any).rol?.rol_name;
    return this._mapToUserRole(rolName);
  });

  // Computed signals de roles
  readonly currentRole = computed<UserRole>(() => this.activeRole());
  readonly isOwner = computed<boolean>(() => this.activeRole() === 'OWNER');
  readonly isSeller = computed<boolean>(() => this.activeRole() === 'SELLER');
  readonly isDriver = computed<boolean>(() => this.activeRole() === 'DRIVER');

  // Etiqueta legible del rol real obtenido de la base de datos
  readonly roleLabel = computed<string>(() => {
    const assignment = this.currentRoleAssignment();
    if (assignment) {
      const rawName = assignment.rol_name || (assignment as any).rol?.rol_name;
      if (rawName) return rawName;
    }
    const defaultLabels: Record<UserRole, string> = {
      OWNER: 'Dueño / Admin',
      SELLER: 'Vendedor (Calle)',
      DRIVER: 'Repartidor (Camioneta)'
    };
    return defaultLabels[this.activeRole()];
  });

  // Capacidades operativas según rol y módulos activos
  readonly canProduce = computed<boolean>(() => this.hasProduction() && this.isOwner());
  readonly canTakeOrders = computed<boolean>(() => this.hasSales() && (this.isOwner() || this.isSeller()));
  readonly canDeliver = computed<boolean>(() => this.hasSales() && (this.isOwner() || this.isDriver()));

  constructor() {
    // Sincronización reactiva con LocalStorage
    effect(() => {
      const company = this.activeCompany();
      if (company) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_COMPANY, JSON.stringify(company));
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_COMPANY);
      }
    });

    effect(() => {
      const roles = this.userRoles();
      localStorage.setItem(STORAGE_KEYS.USER_ROLES, JSON.stringify(roles));
    });

    effect(() => {
      const roleUuid = this.activeRoleUuid();
      if (roleUuid) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_ROLE_UUID, roleUuid);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_ROLE_UUID);
      }
    });

    // Auto-recuperación si hay un usuario logueado en LocalStorage
    this._tryAutoLoadUserContext();
  }

  /**
   * Carga las membresías de empresa y roles del usuario desde la API
   * y configura la compañía y rol activos.
   */
  public loadUserContext(usr_uuid: string): Observable<UserRolCompanyResultsInterface> {
    return this._userRolesCompanyService.getUserRolesCompanyByUser(usr_uuid).pipe(
      tap((res) => {
        if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
          this.setUserRoles(res.data);

          // Extraer compañías únicas
          const companyMap = new Map<string, CompanyInterface>();
          for (const item of res.data) {
            const cmpRaw = (item as any).cmp;
            if (cmpRaw && cmpRaw.cmp_uuid) {
              companyMap.set(cmpRaw.cmp_uuid, cmpRaw as CompanyInterface);
            } else if (item.cmp_uuid) {
              if (!companyMap.has(item.cmp_uuid)) {
                companyMap.set(item.cmp_uuid, {
                  cmp_uuid: item.cmp_uuid,
                  cmp_name: item.cmp_name || 'Compañía'
                });
              }
            }
          }

          const companies = Array.from(companyMap.values());
          this.setCompanies(companies);

          // Si no hay activa o la activa no está entre las del usuario, fijar la primera
          const currentActive = this.activeCompany();
          let targetCompany = currentActive;
          if (!currentActive || !companies.some((c) => c.cmp_uuid === currentActive.cmp_uuid)) {
            if (companies.length > 0) {
              targetCompany = companies[0];
              this.setActiveCompany(targetCompany);
            }
          }

          // Resolver rol inicial en la compañía seleccionada
          if (targetCompany) {
            const companyRoles = res.data.filter((r) => r.cmp_uuid === targetCompany.cmp_uuid);
            if (companyRoles.length > 0) {
              const currentUuid = this.activeRoleUuid();
              const hasCurrent = companyRoles.some((r) => r.rol_uuid === currentUuid);
              if (!hasCurrent) {
                this.setActiveRoleUuid(companyRoles[0].rol_uuid);
              }
            }
          }
        }
      })
    );
  }

  public setCompanies(companies: CompanyInterface[]): void {
    this.companies.set(companies);
    if (!this.activeCompany() && companies.length > 0) {
      this.setActiveCompany(companies[0]);
    }
  }

  public setActiveCompany(company: CompanyInterface | null): void {
    this.activeCompany.set(company);
    if (company) {
      const companyRoles = this.userRoles().filter((r) => r.cmp_uuid === company.cmp_uuid);
      if (companyRoles.length > 0) {
        const currentUuid = this.activeRoleUuid();
        const hasCurrent = companyRoles.some((r) => r.rol_uuid === currentUuid);
        if (!hasCurrent) {
          this.setActiveRoleUuid(companyRoles[0].rol_uuid);
        }
      }
    }
  }

  public setUserRoles(roles: UserRolCompanyInterface[]): void {
    this.userRoles.set(roles);
  }

  public setActiveRoleUuid(rol_uuid: string): void {
    this.activeRoleUuid.set(rol_uuid);
  }

  public toggleProduction(): void {
    this.hasProduction.update((prev) => !prev);
  }

  public toggleSales(): void {
    this.hasSales.update((prev) => !prev);
  }

  public setHasProduction(enabled: boolean): void {
    this.hasProduction.set(enabled);
  }

  public setHasSales(enabled: boolean): void {
    this.hasSales.set(enabled);
  }

  public getRoleItemName(item?: UserRolCompanyInterface | null): string {
    if (!item) return 'Rol ATS';
    return item.rol_name || (item as any).rol?.rol_name || 'Rol ATS';
  }

  private _tryAutoLoadUserContext(): void {
    try {
      const storedUser = localStorage.getItem('ats_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed?.usr_uuid && !this.activeCompany()) {
          this.loadUserContext(parsed.usr_uuid).subscribe({
            error: (err) => console.warn('No se pudo inicializar user context:', err)
          });
        }
      }
    } catch {
      // Ignorar fallback de lectura
    }
  }

  private _mapToUserRole(rolName?: string): UserRole {
    if (!rolName) return 'OWNER';
    const lower = rolName.toLowerCase();
    if (lower.includes('vendedor') || lower.includes('seller') || lower.includes('preventa') || lower.includes('comercial')) {
      return 'SELLER';
    }
    if (
      lower.includes('repartidor') ||
      lower.includes('chofer') ||
      lower.includes('driver') ||
      lower.includes('entrega') ||
      lower.includes('logistica')
    ) {
      return 'DRIVER';
    }
    return 'OWNER';
  }

  private loadStoredCompany(): CompanyInterface | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_COMPANY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private loadStoredUserRoles(): UserRolCompanyInterface[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER_ROLES);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private loadStoredActiveRoleUuid(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_ROLE_UUID) || null;
    } catch {
      return null;
    }
  }
}

export { CompanyContextService as CompanyContext };

