import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CompanyContextService } from '@services/company-context';
import { AuthService } from '@services/auth';
import { OfflineStatusBadgeComponent } from '@components/offline-status-badge/offline-status-badge';
import { UserRolCompanyInterface } from '@interfaces/user-rol-company';

@Component({
  selector: 'app-user-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    OfflineStatusBadgeComponent
  ],
  templateUrl: './user-layout.component.html',
  styleUrl: './user-layout.component.scss'
})
export class UserLayoutComponent {
  readonly companyContext = inject(CompanyContextService);
  readonly authService = inject(AuthService);

  // Sesión y Usuario autenticado
  readonly currentUser = this.authService.currentUser;

  // Contexto Multitenant
  readonly companies = this.companyContext.companies;
  readonly activeCompany = this.companyContext.activeCompany;

  // Roles reales en la compañía activa desde user-roles-company
  readonly activeCompanyRoles = this.companyContext.activeCompanyRoles;
  readonly activeRoleUuid = this.companyContext.activeRoleUuid;
  readonly roleLabel = this.companyContext.roleLabel;
  readonly role = this.companyContext.activeRole;

  // Permisos según rol real y módulos operativos
  readonly showProduction = this.companyContext.canProduce;
  readonly showOrders = this.companyContext.canTakeOrders;
  readonly showDelivery = this.companyContext.canDeliver;
  readonly showOrdersHistory = computed<boolean>(
    () => this.companyContext.hasSales() && (this.role() === 'OWNER' || this.role() === 'SELLER')
  );
  readonly showCustomers = computed<boolean>(
    () => this.companyContext.hasSales() && (this.role() === 'OWNER' || this.role() === 'SELLER')
  );
  readonly showProducts = computed<boolean>(
    () => this.role() === 'OWNER' || this.role() === 'SELLER'
  );
  readonly showPriceTiers = computed<boolean>(
    () => this.role() === 'OWNER'
  );
  readonly showMachines = computed<boolean>(
    () => this.companyContext.hasProduction() && this.role() === 'OWNER'
  );
  readonly showStockMovements = computed<boolean>(
    () => this.role() === 'OWNER'
  );
  readonly showTeam = computed<boolean>(
    () => this.role() === 'OWNER'
  );

  // Nombre formateado e iniciales
  readonly userName = computed<string>(() => {
    const user = this.currentUser();
    if (!user) return 'Usuario ATS';
    if (user.usr_name || user.usr_surname) {
      return `${user.usr_name || ''} ${user.usr_surname || ''}`.trim();
    }
    return user.usr_nick || user.usr_email || 'Usuario ATS';
  });

  readonly userInitials = computed<string>(() => {
    const user = this.currentUser();
    if (!user) return 'AT';
    const first = user.usr_name ? user.usr_name.trim().charAt(0) : '';
    const last = user.usr_surname ? user.usr_surname.trim().charAt(0) : '';
    const initials = `${first}${last}`.toUpperCase();
    return initials || (user.usr_nick ? user.usr_nick.charAt(0).toUpperCase() : 'U');
  });

  public onRoleUuidChange(newRolUuid: string): void {
    this.companyContext.setActiveRoleUuid(newRolUuid);
  }

  public onCompanyChange(cmpUuid: string): void {
    const found = this.companies().find((c) => c.cmp_uuid === cmpUuid);
    if (found) {
      this.companyContext.setActiveCompany(found);
    }
  }

  public getRoleName(item: UserRolCompanyInterface): string {
    return this.companyContext.getRoleItemName(item);
  }

  public onLogout(): void {
    this.authService.logout();
  }
}

