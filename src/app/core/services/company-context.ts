import { Injectable, computed, effect, signal } from '@angular/core';
import { CompanyInterface } from '@interfaces/company';
import { UserRolCompanyInterface } from '@interfaces/user-rol-company';

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
