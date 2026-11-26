import { Component, computed, inject, signal, effect } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CompanyContextService } from '@services/company-context';
import { AuthService } from '@services/auth';
import { MenusService } from '@services/menus';
import { CompanyMenusService } from '@services/company-menus';
import { OfflineStatusBadgeComponent } from '@components/offline-status-badge/offline-status-badge';
import { UserRolCompanyInterface } from '@interfaces/user-rol-company';
import { MenuItemTree, MenuInterface } from '@interfaces/menu';
import { CompanyMenuInterface } from '@interfaces/company-menu';

export interface DynamicNavMenuItem {
  key: string;
  route: string;
  title: string;
  icon: string;
  order: number;
  active: boolean;
  showOnDashboard: boolean;
  isParent: boolean;
  children?: DynamicNavMenuItem[];
}

@Component({
  selector: 'app-user-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    OfflineStatusBadgeComponent,
  ],
  templateUrl: './user-layout.component.html',
  styleUrl: './user-layout.component.scss',
})
export class UserLayoutComponent {
  readonly companyContext = inject(CompanyContextService);
  readonly authService = inject(AuthService);
  readonly menusService = inject(MenusService);
  readonly companyMenusService = inject(CompanyMenusService);

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
  readonly showPriceTiers = computed<boolean>(() => this.role() === 'OWNER');
  readonly showMachines = computed<boolean>(
    () => this.companyContext.hasProduction() && this.role() === 'OWNER'
  );
  readonly showStockMovements = computed<boolean>(() => this.role() === 'OWNER');
  readonly showTeam = computed<boolean>(() => this.role() === 'OWNER');
  readonly showApplicationConfig = computed<boolean>(() => this.companyContext.hasSysAdminRole());

  // Menús cargados del backend
  private rawMenuTree = signal<MenuItemTree[]>([]);
  private rawCompanyOverrides = signal<CompanyMenuInterface[]>([]);
  readonly isLoadingMenu = signal<boolean>(false);

  // Fallback estático estándar
  private defaultStaticItems: DynamicNavMenuItem[] = [
    { key: 'dashboard', route: 'dashboard', title: 'Tablero y Depósito', icon: 'bi-grid-1x2-fill', order: 1, active: true, showOnDashboard: true, isParent: false },
    { key: 'production', route: 'production', title: 'Producción e Insumos', icon: 'bi-gear-fill', order: 2, active: true, showOnDashboard: true, isParent: false },
    { key: 'new-order', route: 'new-order', title: 'Nuevo Pedido (POS)', icon: 'bi-plus-circle-fill', order: 3, active: true, showOnDashboard: true, isParent: false },
    { key: 'delivery', route: 'delivery', title: 'Carga y Reparto', icon: 'bi-truck', order: 4, active: true, showOnDashboard: true, isParent: false },
    { key: 'orders', route: 'orders', title: 'Historial de Pedidos', icon: 'bi-receipt', order: 5, active: true, showOnDashboard: false, isParent: false },
    { key: 'customers', route: 'customers', title: 'Agenda de Clientes', icon: 'bi-people-fill', order: 6, active: true, showOnDashboard: false, isParent: false },
    { key: 'products', route: 'products', title: 'Catálogo de Productos', icon: 'bi-box-seam-fill', order: 7, active: true, showOnDashboard: false, isParent: false },
    { key: 'price-tiers', route: 'price-tiers', title: 'Listas de Precios', icon: 'bi-tag-fill', order: 8, active: true, showOnDashboard: false, isParent: false },
    { key: 'machines', route: 'machines', title: 'Máquinas y Líneas', icon: 'bi-cpu-fill', order: 9, active: true, showOnDashboard: false, isParent: false },
    { key: 'stock-movements', route: 'stock-movements', title: 'Kardex de Stock', icon: 'bi-journal-text', order: 10, active: true, showOnDashboard: false, isParent: false },
    { key: 'team', route: 'team', title: 'Equipo de Trabajo', icon: 'bi-person-badge-fill', order: 11, active: true, showOnDashboard: false, isParent: false },
  ];

  constructor() {
    // Escuchar reactivamente los cambios de empresa activa y recargar menús
    effect(() => {
      const cmp = this.activeCompany();
      if (cmp && cmp.cmp_uuid) {
        this.loadMenusForCompany(cmp.cmp_uuid);
      }
    });
  }

  private loadMenusForCompany(cmpUuid: string): void {
    this.isLoadingMenu.set(true);
    forkJoin({
      tree: this.menusService.getMenuTree().pipe(catchError(() => of({ data: [] }))),
      overrides: this.companyMenusService.getCompanyMenus(cmpUuid).pipe(catchError(() => of({ data: [] }))),
    }).subscribe({
      next: ({ tree, overrides }) => {
        this.rawMenuTree.set(tree.data || []);
        this.rawCompanyOverrides.set(overrides.data || []);
        this.isLoadingMenu.set(false);
      },
      error: () => {
        this.isLoadingMenu.set(false);
      },
    });
  }

  // Menús de navegación dinámicos fusionados y filtrados por permisos RBAC
  readonly dynamicNavItems = computed<DynamicNavMenuItem[]>(() => {
    const rawTree = this.rawMenuTree();
    const overrides = this.rawCompanyOverrides();

    // Si el backend aún no respondió o no hay árbol configurado, usar fallback estándar con permisos
    if (!rawTree || rawTree.length === 0) {
      return this.filterByRbac(this.defaultStaticItems);
    }

    // Mapa de personalizaciones por mnu_uuid
    const ovMap = new Map<string, CompanyMenuInterface>();
    overrides.forEach((ov) => ovMap.set(ov.mnu_uuid, ov));

    // Aplanar y fusionar nodos
    const list: DynamicNavMenuItem[] = [];

    const processNode = (node: MenuItemTree) => {
      const ov = ovMap.get(node.mnu_uuid);

      const effectiveTitle = (ov && ov.cmpmnu_title) ? ov.cmpmnu_title : node.mnu_title;
      const effectiveIcon = (ov && ov.cmpmnu_icon) ? ov.cmpmnu_icon : (node.mnu_icon || 'bi-circle');
      const effectiveOrder = (ov && ov.cmpmnu_order !== null && ov.cmpmnu_order !== undefined)
        ? ov.cmpmnu_order
        : node.mnu_order;
      const effectiveActive = (ov && ov.cmpmnu_active !== null && ov.cmpmnu_active !== undefined)
        ? ov.cmpmnu_active
        : node.mnu_active;
      const effectiveShowOnDashboard = (ov && ov.cmpmnu_showondashboard !== null && ov.cmpmnu_showondashboard !== undefined)
        ? ov.cmpmnu_showondashboard
        : !!node.mnu_showondashboard;

      // Normalizar ruta: si viene con prefijos como /admin/user/ se limpia
      let cleanRoute = (node.mnu_route || '').trim();
      if (cleanRoute.startsWith('/admin/user/')) {
        cleanRoute = cleanRoute.replace('/admin/user/', '');
      } else if (cleanRoute.startsWith('/')) {
        cleanRoute = cleanRoute.substring(1);
      }

      const item: DynamicNavMenuItem = {
        key: node.mnu_cod || cleanRoute || node.mnu_uuid,
        route: cleanRoute,
        title: effectiveTitle,
        icon: effectiveIcon,
        order: effectiveOrder,
        active: effectiveActive,
        showOnDashboard: effectiveShowOnDashboard,
        isParent: !!(node.items && node.items.length > 0 && !cleanRoute),
      };

      if (node.items && node.items.length > 0) {
        node.items.forEach((child) => processNode(child));
      } else if (cleanRoute) {
        list.push(item);
      }
    };

    rawTree.forEach((root) => processNode(root));

    // Si no hubo rutas hojas válidas, usar fallback
    if (list.length === 0) {
      return this.filterByRbac(this.defaultStaticItems);
    }

    // Filtrar los que estén activos para la empresa
    const activeList = list.filter((i) => i.active);

    // Filtrar por permisos del rol operativo
    const permittedList = this.filterByRbac(activeList);

    // Ordenar por order
    permittedList.sort((a, b) => a.order - b.order);

    return permittedList;
  });

  // Ítems para la barra inferior en móviles (top 5 más importantes)
  readonly bottomNavItems = computed<DynamicNavMenuItem[]>(() => {
    const all = this.dynamicNavItems();
    return all.slice(0, 5);
  });

  private filterByRbac(items: DynamicNavMenuItem[]): DynamicNavMenuItem[] {
    return items.filter((item) => {
      const r = item.route.toLowerCase();

      if (r === 'dashboard') return true;
      if (r === 'production' && !this.showProduction()) return false;
      if (r === 'new-order' && !this.showOrders()) return false;
      if (r === 'delivery' && !this.showDelivery()) return false;
      if (r === 'orders' && !this.showOrdersHistory()) return false;
      if (r === 'customers' && !this.showCustomers()) return false;
      if (r === 'products' && !this.showProducts()) return false;
      if (r === 'price-tiers' && !this.showPriceTiers()) return false;
      if (r === 'machines' && !this.showMachines()) return false;
      if (r === 'stock-movements' && !this.showStockMovements()) return false;
      if (r === 'team' && !this.showTeam()) return false;

      return true;
    });
  }

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
