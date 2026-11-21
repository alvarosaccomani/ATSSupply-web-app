import { Component, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';

export type UserRole = 'OWNER' | 'SELLER' | 'DRIVER';

@Component({
  selector: 'app-user-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './user-layout.component.html',
  styleUrl: './user-layout.component.scss'
})
export class UserLayoutComponent {
  // Feature flags simuladas
  readonly hasProduction = signal<boolean>(true);
  readonly hasSales = signal<boolean>(true);
  readonly role = signal<UserRole>('OWNER');

  readonly roleLabel = computed<string>(() => {
    const labels: Record<UserRole, string> = {
      OWNER: 'Dueño / Admin',
      SELLER: 'Vendedor (Calle)',
      DRIVER: 'Repartidor (Camioneta)'
    };
    return labels[this.role()];
  });

  readonly showProduction = computed<boolean>(() => this.hasProduction() && this.role() === 'OWNER');
  readonly showOrders = computed<boolean>(() => this.hasSales() && (this.role() === 'OWNER' || this.role() === 'SELLER'));
  readonly showDelivery = computed<boolean>(() => this.hasSales() && (this.role() === 'OWNER' || this.role() === 'DRIVER'));
  readonly showCustomers = computed<boolean>(() => this.hasSales() && (this.role() === 'OWNER' || this.role() === 'SELLER'));

  onRoleChange(newRole: string): void {
    this.role.set(newRole as UserRole);
  }

  toggleProduction(): void {
    this.hasProduction.update((val) => !val);
  }

  toggleSales(): void {
    this.hasSales.update((val) => !val);
  }
}
