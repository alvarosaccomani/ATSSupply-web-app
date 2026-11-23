import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CompanyContextService, UserRole } from '@services/company-context';

@Component({
  selector: 'app-user-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './user-layout.component.html',
  styleUrl: './user-layout.component.scss'
})
export class UserLayoutComponent {
  readonly companyContext = inject(CompanyContextService);

  readonly hasProduction = this.companyContext.hasProduction;
  readonly hasSales = this.companyContext.hasSales;
  readonly role = this.companyContext.activeRole;
  readonly roleLabel = this.companyContext.roleLabel;
  readonly activeCompany = this.companyContext.activeCompany;

  readonly showProduction = this.companyContext.canProduce;
  readonly showOrders = this.companyContext.canTakeOrders;
  readonly showDelivery = this.companyContext.canDeliver;
  readonly showCustomers = computed<boolean>(
    () => this.hasSales() && (this.role() === 'OWNER' || this.role() === 'SELLER')
  );
  readonly showProducts = computed<boolean>(
    () => this.role() === 'OWNER' || this.role() === 'SELLER'
  );

  onRoleChange(newRole: string): void {
    this.companyContext.setActiveRole(newRole as UserRole);
  }

  toggleProduction(): void {
    this.companyContext.toggleProduction();
  }

  toggleSales(): void {
    this.companyContext.toggleSales();
  }
}
