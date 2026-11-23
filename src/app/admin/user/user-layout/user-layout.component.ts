import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CompanyContextService, UserRole } from '@services/company-context';
import { AuthService } from '@services/auth';
import { CompanyInterface } from '@interfaces/company';

@Component({
  selector: 'app-user-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
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

  // Roles y Módulos
  readonly hasProduction = this.companyContext.hasProduction;
  readonly hasSales = this.companyContext.hasSales;
  readonly role = this.companyContext.activeRole;
  readonly roleLabel = this.companyContext.roleLabel;

  // Permisos según rol
  readonly showProduction = this.companyContext.canProduce;
  readonly showOrders = this.companyContext.canTakeOrders;
  readonly showDelivery = this.companyContext.canDeliver;
  readonly showCustomers = computed<boolean>(
    () => this.hasSales() && (this.role() === 'OWNER' || this.role() === 'SELLER')
  );
  readonly showProducts = computed<boolean>(
    () => this.role() === 'OWNER' || this.role() === 'SELLER'
  );

  // Estado del toolbar de simulación/desarrollo
  readonly isDevToolbarOpen = signal<boolean>(false);

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

  public onRoleChange(newRole: string): void {
    this.companyContext.setActiveRole(newRole as UserRole);
  }

  public onCompanyChange(cmpUuid: string): void {
    const found = this.companies().find((c) => c.cmp_uuid === cmpUuid);
    if (found) {
      this.companyContext.setActiveCompany(found);
    }
  }

  public toggleProduction(): void {
    this.companyContext.toggleProduction();
  }

  public toggleSales(): void {
    this.companyContext.toggleSales();
  }

  public toggleDevToolbar(): void {
    this.isDevToolbarOpen.update((v) => !v);
  }

  public onLogout(): void {
    this.authService.logout();
  }
}
