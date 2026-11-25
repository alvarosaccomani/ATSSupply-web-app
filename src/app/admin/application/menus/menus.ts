import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenusService } from '@services/menus';
import { MenuItemTree, MenuInterface } from '@interfaces/menu';

@Component({
  selector: 'app-menus',
  imports: [CommonModule, FormsModule],
  templateUrl: './menus.html',
  styleUrl: './menus.scss',
})
export class Menus implements OnInit {
  private menusService = inject(MenusService);

  // Signals de estado
  menuTree = signal<MenuItemTree[]>([]);
  allMenusFlat = signal<MenuInterface[]>([]);
  searchTerm = signal<string>('');

  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Modal Crear / Editar
  isModalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  formData = signal<{
    mnu_uuid?: string;
    mnu_parent_uuid?: string | null;
    mnu_cod: string;
    mnu_title: string;
    mnu_description: string;
    mnu_icon: string;
    mnu_route: string;
    mnu_order: number;
    mnu_itemactive: boolean;
    mnu_active: boolean;
    mnu_showifcompanyactive: boolean;
    mnu_showondashboard: boolean;
    mnu_dashboardtitle: string;
    mnu_dashboardicon: string;
  }>({
    mnu_parent_uuid: null,
    mnu_cod: '',
    mnu_title: '',
    mnu_description: '',
    mnu_icon: 'bi-grid',
    mnu_route: '',
    mnu_order: 1,
    mnu_itemactive: true,
    mnu_active: true,
    mnu_showifcompanyactive: false,
    mnu_showondashboard: false,
    mnu_dashboardtitle: '',
    mnu_dashboardicon: '',
  });

  // Modal Confirmación Eliminar
  isDeleteModalOpen = signal<boolean>(false);
  menuToDelete = signal<MenuInterface | null>(null);

  // Árbol filtrado por término de búsqueda
  filteredMenuTree = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const tree = this.menuTree();

    if (!term) return tree;

    const filterNode = (node: MenuItemTree): MenuItemTree | null => {
      const matches =
        node.mnu_title.toLowerCase().includes(term) ||
        (node.mnu_route && node.mnu_route.toLowerCase().includes(term)) ||
        (node.mnu_cod && node.mnu_cod.toLowerCase().includes(term)) ||
        (node.mnu_description && node.mnu_description.toLowerCase().includes(term));

      const filteredChildren = (node.items || [])
        .map((child) => filterNode(child))
        .filter((c): c is MenuItemTree => c !== null);

      if (matches || filteredChildren.length > 0) {
        return {
          ...node,
          items: filteredChildren,
        };
      }
      return null;
    };

    return tree.map((root) => filterNode(root)).filter((r): r is MenuItemTree => r !== null);
  });

  // Lista de posibles menús padres (nodos raíz o contenedores sin parent)
  parentOptions = computed(() => {
    return this.allMenusFlat().filter((m) => !m.mnu_parent_uuid);
  });

  // Total de menús activos computado
  totalActive = computed(() => {
    return this.allMenusFlat().filter((m) => m.mnu_active).length;
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.menusService.getMenuTree().subscribe({
      next: (res) => {
        const tree = res.data || [];
        this.menuTree.set(tree);

        // Aplanar para listado auxiliar
        const flat: MenuInterface[] = [];
        const flatten = (items: MenuItemTree[]) => {
          items.forEach((it) => {
            flat.push(it);
            if (it.items && it.items.length > 0) {
              flatten(it.items);
            }
          });
        };
        flatten(tree);
        this.allMenusFlat.set(flat);

        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set('Error al cargar la estructura del catálogo de menús.');
        this.isLoading.set(false);
      },
    });
  }

  openCreateModal(parentUuid: string | null = null): void {
    this.isEditing.set(false);
    this.formData.set({
      mnu_parent_uuid: parentUuid,
      mnu_cod: '',
      mnu_title: '',
      mnu_description: '',
      mnu_icon: 'bi-grid',
      mnu_route: '',
      mnu_order: (this.allMenusFlat().length + 1),
      mnu_itemactive: true,
      mnu_active: true,
      mnu_showifcompanyactive: false,
      mnu_showondashboard: false,
      mnu_dashboardtitle: '',
      mnu_dashboardicon: '',
    });
    this.isModalOpen.set(true);
  }

  openEditModal(menu: MenuInterface): void {
    this.isEditing.set(true);
    this.formData.set({
      mnu_uuid: menu.mnu_uuid,
      mnu_parent_uuid: menu.mnu_parent_uuid || null,
      mnu_cod: menu.mnu_cod || '',
      mnu_title: menu.mnu_title,
      mnu_description: menu.mnu_description || '',
      mnu_icon: menu.mnu_icon || 'bi-circle',
      mnu_route: menu.mnu_route || '',
      mnu_order: menu.mnu_order,
      mnu_itemactive: menu.mnu_itemactive,
      mnu_active: menu.mnu_active,
      mnu_showifcompanyactive: menu.mnu_showifcompanyactive,
      mnu_showondashboard: !!menu.mnu_showondashboard,
      mnu_dashboardtitle: menu.mnu_dashboardtitle || '',
      mnu_dashboardicon: menu.mnu_dashboardicon || '',
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  saveMenu(): void {
    const form = this.formData();

    if (!form.mnu_title.trim()) {
      this.errorMessage.set('El título del menú es obligatorio.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const payload: Partial<MenuInterface> = {
      mnu_parent_uuid: form.mnu_parent_uuid || null,
      mnu_cod: form.mnu_cod.trim() || null,
      mnu_title: form.mnu_title.trim(),
      mnu_description: form.mnu_description.trim() || null,
      mnu_icon: form.mnu_icon.trim() || 'bi-circle',
      mnu_route: form.mnu_route.trim() || null,
      mnu_order: Number(form.mnu_order),
      mnu_itemactive: form.mnu_itemactive,
      mnu_active: form.mnu_active,
      mnu_showifcompanyactive: form.mnu_showifcompanyactive,
      mnu_showondashboard: form.mnu_showondashboard,
      mnu_dashboardtitle: form.mnu_dashboardtitle.trim() || null,
      mnu_dashboardicon: form.mnu_dashboardicon.trim() || null,
    };

    if (this.isEditing() && form.mnu_uuid) {
      this.menusService.updateMenu(form.mnu_uuid, payload).subscribe({
        next: () => {
          this.successMessage.set(`Ítem de menú "${form.mnu_title}" actualizado.`);
          this.isSaving.set(false);
          this.closeModal();
          this.loadData();
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message || 'Error al actualizar ítem de menú.');
          this.isSaving.set(false);
        },
      });
    } else {
      this.menusService.saveMenu(payload).subscribe({
        next: () => {
          this.successMessage.set(`Ítem de menú "${form.mnu_title}" creado con éxito.`);
          this.isSaving.set(false);
          this.closeModal();
          this.loadData();
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message || 'Error al crear ítem de menú.');
          this.isSaving.set(false);
        },
      });
    }
  }

  toggleActive(menu: MenuInterface): void {
    const nextActive = !menu.mnu_active;
    this.menusService.updateMenu(menu.mnu_uuid, { mnu_active: nextActive }).subscribe({
      next: () => this.loadData(),
      error: () => this.errorMessage.set('Error al conmutar estado del menú.'),
    });
  }

  openDeleteModal(menu: MenuInterface): void {
    this.menuToDelete.set(menu);
    this.isDeleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.isDeleteModalOpen.set(false);
    this.menuToDelete.set(null);
  }

  confirmDelete(): void {
    const item = this.menuToDelete();
    if (!item) return;

    this.isSaving.set(true);
    this.menusService.deleteMenu(item.mnu_uuid).subscribe({
      next: () => {
        this.successMessage.set(`Menú "${item.mnu_title}" eliminado del catálogo maestro.`);
        this.isSaving.set(false);
        this.closeDeleteModal();
        this.loadData();
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error al eliminar ítem de menú.');
        this.isSaving.set(false);
      },
    });
  }
}
