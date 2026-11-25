import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CompaniesService } from '@services/companies';
import { MenusService } from '@services/menus';
import { CompanyMenusService } from '@services/company-menus';
import { CompanyInterface } from '@interfaces/company';
import { MenuItemTree, MenuInterface } from '@interfaces/menu';
import { CompanyMenuInterface } from '@interfaces/company-menu';

export interface MergedMenuItem {
  base: MenuInterface;
  override?: CompanyMenuInterface | null;
  // Propiedades efectivas para la empresa
  effectiveTitle: string;
  effectiveIcon: string;
  effectiveOrder: number;
  effectiveActive: boolean;
  effectiveShowOnDashboard: boolean;
  isCustomized: boolean;
  children?: MergedMenuItem[];
}

@Component({
  selector: 'app-company-menus',
  imports: [CommonModule, FormsModule],
  templateUrl: './company-menus.html',
  styleUrl: './company-menus.scss',
})
export class CompanyMenus implements OnInit {
  private companiesService = inject(CompaniesService);
  private menusService = inject(MenusService);
  private companyMenusService = inject(CompanyMenusService);

  // Signals de estado
  companies = signal<CompanyInterface[]>([]);
  selectedCompanyUuid = signal<string>('');
  menuTree = signal<MenuItemTree[]>([]);
  companyOverrides = signal<CompanyMenuInterface[]>([]);
  searchTerm = signal<string>('');

  isLoadingCompanies = signal<boolean>(false);
  isLoadingData = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Modal de Personalización (Edit Override)
  isModalOpen = signal<boolean>(false);
  editingItem = signal<MergedMenuItem | null>(null);
  formData = signal<{
    cmpmnu_title: string;
    cmpmnu_description: string;
    cmpmnu_icon: string;
    cmpmnu_order: number;
    cmpmnu_showondashboard: boolean;
    cmpmnu_active: boolean;
  }>({
    cmpmnu_title: '',
    cmpmnu_description: '',
    cmpmnu_icon: '',
    cmpmnu_order: 1,
    cmpmnu_showondashboard: false,
    cmpmnu_active: true,
  });

  // Modal Confirmación Restaurar
  isRestoreModalOpen = signal<boolean>(false);
  itemToRestore = signal<MergedMenuItem | null>(null);

  // Mapa de overrides por mnu_uuid para búsqueda O(1)
  private overridesMap = computed(() => {
    const map = new Map<string, CompanyMenuInterface>();
    this.companyOverrides().forEach((ov) => {
      map.set(ov.mnu_uuid, ov);
    });
    return map;
  });

  // Árbol fusionado con overrides aplicados
  mergedMenuTree = computed(() => {
    const rawTree = this.menuTree();
    const map = this.overridesMap();

    const mergeNode = (node: MenuItemTree): MergedMenuItem => {
      const ov = map.get(node.mnu_uuid) || null;
      const isCustomized = !!ov;

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

      const children = (node.items || []).map((child) => mergeNode(child));
      children.sort((a, b) => a.effectiveOrder - b.effectiveOrder);

      return {
        base: node,
        override: ov,
        effectiveTitle,
        effectiveIcon,
        effectiveOrder,
        effectiveActive,
        effectiveShowOnDashboard,
        isCustomized,
        children,
      };
    };

    const tree = rawTree.map((root) => mergeNode(root));
    tree.sort((a, b) => a.effectiveOrder - b.effectiveOrder);
    return tree;
  });

  // Filtro de búsqueda sobre el árbol
  filteredMenuTree = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const tree = this.mergedMenuTree();

    if (!term) return tree;

    const filterNode = (node: MergedMenuItem): MergedMenuItem | null => {
      const matches =
        node.effectiveTitle.toLowerCase().includes(term) ||
        node.base.mnu_title.toLowerCase().includes(term) ||
        (node.base.mnu_route && node.base.mnu_route.toLowerCase().includes(term)) ||
        (node.base.mnu_cod && node.base.mnu_cod.toLowerCase().includes(term));

      const filteredChildren = (node.children || [])
        .map((child) => filterNode(child))
        .filter((c): c is MergedMenuItem => c !== null);

      if (matches || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
      return null;
    };

    return tree.map((root) => filterNode(root)).filter((r): r is MergedMenuItem => r !== null);
  });

  // Total de personalizaciones computado
  totalCustomized = computed(() => {
    let count = 0;
    const countCustom = (items: MergedMenuItem[]) => {
      items.forEach((item) => {
        if (item.isCustomized) count++;
        if (item.children) countCustom(item.children);
      });
    };
    countCustom(this.mergedMenuTree());
    return count;
  });

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(): void {
    this.isLoadingCompanies.set(true);
    this.errorMessage.set(null);
    this.companiesService.getCompanies().subscribe({
      next: (res) => {
        const list = (res.data || []) as CompanyInterface[];
        const active = list.filter((c) => c.cmp_status !== 'INACTIVE');
        this.companies.set(active);
        if (active.length > 0) {
          this.selectedCompanyUuid.set(active[0].cmp_uuid);
          this.loadData();
        }
        this.isLoadingCompanies.set(false);
      },
      error: (err) => {
        this.errorMessage.set('Error al cargar la lista de empresas.');
        this.isLoadingCompanies.set(false);
      },
    });
  }

  onCompanyChange(cmpUuid: string): void {
    this.selectedCompanyUuid.set(cmpUuid);
    this.loadData();
  }

  loadData(): void {
    const cmpUuid = this.selectedCompanyUuid();
    if (!cmpUuid) return;

    this.isLoadingData.set(true);
    this.errorMessage.set(null);

    forkJoin({
      menuTree: this.menusService.getMenuTree(),
      overrides: this.companyMenusService.getCompanyMenus(cmpUuid),
    }).subscribe({
      next: ({ menuTree, overrides }) => {
        this.menuTree.set(menuTree.data || []);
        this.companyOverrides.set(overrides.data || []);
        this.isLoadingData.set(false);
      },
      error: (err) => {
        this.errorMessage.set('Error al cargar la estructura y personalizaciones de menús.');
        this.isLoadingData.set(false);
      },
    });
  }

  openEditModal(item: MergedMenuItem): void {
    this.editingItem.set(item);
    this.formData.set({
      cmpmnu_title: item.override?.cmpmnu_title || item.base.mnu_title,
      cmpmnu_description: item.override?.cmpmnu_description || item.base.mnu_description || '',
      cmpmnu_icon: item.override?.cmpmnu_icon || item.base.mnu_icon || 'bi-circle',
      cmpmnu_order: item.override?.cmpmnu_order ?? item.base.mnu_order,
      cmpmnu_showondashboard: item.override?.cmpmnu_showondashboard ?? (!!item.base.mnu_showondashboard),
      cmpmnu_active: item.override?.cmpmnu_active ?? item.base.mnu_active,
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingItem.set(null);
  }

  saveOverride(): void {
    const item = this.editingItem();
    const cmpUuid = this.selectedCompanyUuid();
    const form = this.formData();

    if (!item || !cmpUuid) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const payload = {
      cmp_uuid: cmpUuid,
      mnu_uuid: item.base.mnu_uuid,
      cmpmnu_title: form.cmpmnu_title.trim() || null,
      cmpmnu_description: form.cmpmnu_description.trim() || null,
      cmpmnu_icon: form.cmpmnu_icon.trim() || null,
      cmpmnu_order: Number(form.cmpmnu_order),
      cmpmnu_showondashboard: form.cmpmnu_showondashboard,
      cmpmnu_active: form.cmpmnu_active,
    };

    if (item.override && item.override.cmpmnu_uuid) {
      // Actualizar override existente
      this.companyMenusService
        .updateCompanyMenu(item.override.cmpmnu_uuid, payload)
        .subscribe({
          next: () => {
            this.successMessage.set(`Personalización de "${item.base.mnu_title}" actualizada.`);
            this.isSaving.set(false);
            this.closeModal();
            this.loadData();
          },
          error: (err) => {
            this.errorMessage.set(err?.error?.message || 'Error al actualizar personalización.');
            this.isSaving.set(false);
          },
        });
    } else {
      // Crear nuevo override para la empresa
      this.companyMenusService.saveCompanyMenu(payload).subscribe({
        next: () => {
          this.successMessage.set(`Personalización para "${item.base.mnu_title}" creada.`);
          this.isSaving.set(false);
          this.closeModal();
          this.loadData();
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message || 'Error al guardar personalización.');
          this.isSaving.set(false);
        },
      });
    }
  }

  toggleActive(item: MergedMenuItem): void {
    const cmpUuid = this.selectedCompanyUuid();
    if (!cmpUuid) return;

    const nextActive = !item.effectiveActive;

    if (item.override && item.override.cmpmnu_uuid) {
      this.companyMenusService
        .updateCompanyMenu(item.override.cmpmnu_uuid, { cmpmnu_active: nextActive })
        .subscribe({
          next: () => this.loadData(),
          error: () => this.errorMessage.set('Error al actualizar estado del menú.'),
        });
    } else {
      this.companyMenusService
        .saveCompanyMenu({
          cmp_uuid: cmpUuid,
          mnu_uuid: item.base.mnu_uuid,
          cmpmnu_active: nextActive,
        })
        .subscribe({
          next: () => this.loadData(),
          error: () => this.errorMessage.set('Error al crear personalización de estado.'),
        });
    }
  }

  toggleDashboard(item: MergedMenuItem): void {
    const cmpUuid = this.selectedCompanyUuid();
    if (!cmpUuid) return;

    const nextDash = !item.effectiveShowOnDashboard;

    if (item.override && item.override.cmpmnu_uuid) {
      this.companyMenusService
        .updateCompanyMenu(item.override.cmpmnu_uuid, { cmpmnu_showondashboard: nextDash })
        .subscribe({
          next: () => this.loadData(),
          error: () => this.errorMessage.set('Error al actualizar visibilidad en dashboard.'),
        });
    } else {
      this.companyMenusService
        .saveCompanyMenu({
          cmp_uuid: cmpUuid,
          mnu_uuid: item.base.mnu_uuid,
          cmpmnu_showondashboard: nextDash,
        })
        .subscribe({
          next: () => this.loadData(),
          error: () => this.errorMessage.set('Error al configurar dashboard.'),
        });
    }
  }

  openRestoreModal(item: MergedMenuItem): void {
    this.itemToRestore.set(item);
    this.isRestoreModalOpen.set(true);
  }

  closeRestoreModal(): void {
    this.isRestoreModalOpen.set(false);
    this.itemToRestore.set(null);
  }

  confirmRestore(): void {
    const item = this.itemToRestore();
    if (!item || !item.override || !item.override.cmpmnu_uuid) return;

    this.isSaving.set(true);
    this.companyMenusService.deleteCompanyMenu(item.override.cmpmnu_uuid).subscribe({
      next: () => {
        this.successMessage.set(`Valores por defecto restablecidos para "${item.base.mnu_title}".`);
        this.isSaving.set(false);
        this.closeRestoreModal();
        this.loadData();
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error al restablecer valores.');
        this.isSaving.set(false);
      },
    });
  }
}
