import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { CompanyInterface } from '@interfaces/company';
import { UserRolCompanyInterface, UserRolCompanyResultsInterface } from '@interfaces/user-rol-company';
import { UserRolesCompanyService } from './user-roles-company';

export type UserRole = 'OWNER' | 'SELLER' | 'DRIVER';

const STORAGE_KEYS = {
  ACTIVE_COMPANY: 'ats_active_company',
  USER_ROLES: 'ats_user_roles',
  ACTIVE_ROLE: 'ats_active_role'
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
  readonly activeRole = signal<UserRole>(this.loadStoredActiveRole());

  // Feature flags de módulos operativos
  readonly hasProduction = signal<boolean>(true);
  readonly hasSales = signal<boolean>(true);

  // Computed signals de roles
  readonly currentRole = computed<UserRole>(() => this.activeRole());
  readonly isOwner = computed<boolean>(() => this.activeRole() === 'OWNER');
  readonly isSeller = computed<boolean>(() => this.activeRole() === 'SELLER');
  readonly isDriver = computed<boolean>(() => this.activeRole() === 'DRIVER');

  readonly roleLabel = computed<string>(() => {
    const labels: Record<UserRole, string> = {
      OWNER: 'Dueño / Admin',
      SELLER: 'Vendedor (Calle)',
      DRIVER: 'Repartidor (Camioneta)'
    };
    return labels[this.activeRole()];
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
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ROLE, this.activeRole());
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
          if (!currentActive || !companies.some((c) => c.cmp_uuid === currentActive.cmp_uuid)) {
            if (companies.length > 0) {
              this.setActiveCompany(companies[0]);
            }
          }

          // Resolver rol inicial
          const firstRolName = (res.data[0] as any).rol?.rol_name || res.data[0].rol_name;
          this.setActiveRole(this._mapToUserRole(firstRolName));
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
  }

  public setUserRoles(roles: UserRolCompanyInterface[]): void {
    this.userRoles.set(roles);
  }

  public setActiveRole(role: UserRole): void {
    this.activeRole.set(role);
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
    if (lower.includes('vendedor') || lower.includes('seller') || lower.includes('preventa')) {
      return 'SELLER';
    }
    if (
      lower.includes('repartidor') ||
      lower.includes('chofer') ||
      lower.includes('driver') ||
      lower.includes('entrega')
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

  private loadStoredActiveRole(): UserRole {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_ROLE) as UserRole | null;
      if (stored === 'OWNER' || stored === 'SELLER' || stored === 'DRIVER') {
        return stored;
      }
    } catch {
      // fallback por defecto
    }
    return 'OWNER';
  }
}

export { CompanyContextService as CompanyContext };
