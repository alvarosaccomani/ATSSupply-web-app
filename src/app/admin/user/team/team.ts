import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CompanyContextService } from '@services/company-context';
import { UserRolesCompanyService } from '@services/user-roles-company';
import { RolesService } from '@services/roles';
import { UsersService } from '@services/users';
import { AuthService } from '@services/auth';
import { UserRolCompanyInterface } from '@interfaces/user-rol-company';
import { RolInterface } from '@interfaces/rol';
import { UserInterface } from '@interfaces/user';

export interface MemberRoleItem {
  rol_uuid: string;
  rol_name: string;
  usrrolcmp_createdat?: Date | string;
}

export interface GroupedMember {
  usr_uuid: string;
  usr_name: string;
  usr_surname?: string;
  usr_nick: string;
  usr_email: string;
  usr_phone?: string;
  roles: MemberRoleItem[];
  firstJoinedAt?: Date | string;
}

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './team.html',
  styleUrl: './team.scss'
})
export class Team implements OnInit {
  private readonly _companyContext = inject(CompanyContextService);
  private readonly _userRolesCompanyService = inject(UserRolesCompanyService);
  private readonly _rolesService = inject(RolesService);
  private readonly _usersService = inject(UsersService);
  private readonly _authService = inject(AuthService);

  // Contexto y Sesión
  readonly activeCompany = this._companyContext.activeCompany;
  readonly currentUser = this._authService.currentUser;

  // Estados reactivos
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Listas de datos
  readonly members = signal<UserRolCompanyInterface[]>([]);
  readonly availableRoles = signal<RolInterface[]>([]);
  readonly allUsers = signal<UserInterface[]>([]);

  // Filtros
  readonly searchQuery = signal<string>('');
  readonly selectedRoleFilter = signal<string>('');

  // Modal para Incorporar Colaborador
  readonly isAddModalOpen = signal<boolean>(false);
  readonly addMode = signal<'new' | 'existing'>('new');

  // Campos para nuevo usuario
  readonly newUsrName = signal<string>('');
  readonly newUsrSurname = signal<string>('');
  readonly newUsrNick = signal<string>('');
  readonly newUsrEmail = signal<string>('');
  readonly newUsrPassword = signal<string>('');
  readonly newRolUuid = signal<string>('');

  // Campos para usuario existente
  readonly existingUsrUuid = signal<string>('');
  readonly existingRolUuid = signal<string>('');

  // Confirmación de desvinculación
  readonly memberToUnlink = signal<GroupedMember | null>(null);

  // Agrupación de colaboradores consolidados por usuario
  readonly groupedMembers = computed<GroupedMember[]>(() => {
    const map = new Map<string, GroupedMember>();

    for (const m of this.members()) {
      const usr_uuid = m.usr_uuid;
      if (!usr_uuid) continue;

      const rol_name = m.rol?.rol_name || m.rol_name || 'Sin Rol';
      const roleItem: MemberRoleItem = {
        rol_uuid: m.rol_uuid,
        rol_name,
        usrrolcmp_createdat: m.usrrolcmp_createdat
      };

      if (!map.has(usr_uuid)) {
        map.set(usr_uuid, {
          usr_uuid,
          usr_name: m.usr?.usr_name || m.usr_name || 'Sin Nombre',
          usr_surname: m.usr?.usr_surname || '',
          usr_nick: m.usr?.usr_nick || 'usuario',
          usr_email: m.usr?.usr_email || '-',
          usr_phone: m.usr?.usr_phone || '',
          roles: [roleItem],
          firstJoinedAt: m.usrrolcmp_createdat
        });
      } else {
        const existing = map.get(usr_uuid)!;
        if (!existing.roles.some((r) => r.rol_uuid === m.rol_uuid)) {
          existing.roles.push(roleItem);
        }
      }
    }

    return Array.from(map.values());
  });

  // Computed KPIs basados en miembros únicos
  readonly totalMembers = computed<number>(() => this.groupedMembers().length);

  readonly countOwners = computed<number>(() => {
    return this.groupedMembers().filter((m) =>
      m.roles.some((r) => {
        const name = r.rol_name.toUpperCase();
        return name.includes('DUEÑO') || name.includes('OWNER') || name.includes('ADMIN');
      })
    ).length;
  });

  readonly countSellers = computed<number>(() => {
    return this.groupedMembers().filter((m) =>
      m.roles.some((r) => {
        const name = r.rol_name.toUpperCase();
        return name.includes('VENDEDOR') || name.includes('SELLER') || name.includes('VENTAS');
      })
    ).length;
  });

  readonly countDrivers = computed<number>(() => {
    return this.groupedMembers().filter((m) =>
      m.roles.some((r) => {
        const name = r.rol_name.toUpperCase();
        return name.includes('CHOFER') || name.includes('DRIVER') || name.includes('LOGISTICA') || name.includes('REPARTO');
      })
    ).length;
  });

  // Usuarios disponibles no vinculados a la compañía
  readonly availableExistingUsers = computed<UserInterface[]>(() => {
    const currentMemberUuids = new Set(this.groupedMembers().map((m) => m.usr_uuid));
    return this.allUsers().filter((u) => !currentMemberUuids.has(u.usr_uuid));
  });

  // Miembros filtrados en la tabla
  readonly filteredMembers = computed<GroupedMember[]>(() => {
    let result = this.groupedMembers();
    const query = this.searchQuery().trim().toLowerCase();
    const roleFilter = this.selectedRoleFilter();

    if (roleFilter) {
      result = result.filter((m) => m.roles.some((r) => r.rol_uuid === roleFilter));
    }

    if (query) {
      result = result.filter((m) => {
        const fullName = `${m.usr_name} ${m.usr_surname || ''}`.toLowerCase();
        const nick = m.usr_nick.toLowerCase();
        const email = m.usr_email.toLowerCase();
        const matchesRole = m.roles.some((r) => r.rol_name.toLowerCase().includes(query));
        return fullName.includes(query) || nick.includes(query) || email.includes(query) || matchesRole;
      });
    }

    return result;
  });

  ngOnInit(): void {
    this.loadInitialData();
  }

  public loadInitialData(): void {
    this.loadRoles();
    this.loadTeam();
    this.loadUsers();
  }

  public loadRoles(): void {
    this._rolesService.getRoles().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.availableRoles.set(res.data);
          if (res.data.length > 0 && !this.newRolUuid()) {
            this.newRolUuid.set(res.data[0].rol_uuid);
            this.existingRolUuid.set(res.data[0].rol_uuid);
          }
        }
      },
      error: (err) => console.error('Error al cargar roles:', err)
    });
  }

  public loadUsers(): void {
    this._usersService.getUsers().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.allUsers.set(res.data);
        }
      },
      error: (err) => console.error('Error al cargar usuarios globales:', err)
    });
  }

  public loadTeam(): void {
    const company = this.activeCompany();
    if (!company?.cmp_uuid) {
      this.members.set([]);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._userRolesCompanyService.getUserRolesCompany(company.cmp_uuid).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const data = (res as any)?.data || [];
        this.members.set(data);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('No se pudo recuperar la nómina del equipo.');
        console.error('Error al cargar equipo:', err);
      }
    });
  }

  public getAvailableRolesForMember(member: GroupedMember): RolInterface[] {
    const memberRolUuids = new Set(member.roles.map((r) => r.rol_uuid));
    return this.availableRoles().filter((r) => !memberRolUuids.has(r.rol_uuid));
  }

  public addRoleToMember(member: GroupedMember, rol_uuid: string): void {
    const company = this.activeCompany();
    if (!company?.cmp_uuid || !rol_uuid) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this._userRolesCompanyService
      .saveUserRolCompany({
        cmp_uuid: company.cmp_uuid,
        usr_uuid: member.usr_uuid,
        rol_uuid
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.successMessage.set(`Rol asignado correctamente a ${member.usr_name}.`);
          this.loadTeam();
          setTimeout(() => this.successMessage.set(null), 3000);
        },
        error: (err) => {
          this.isSaving.set(false);
          this.errorMessage.set(err?.error?.message || 'Error al asignar rol al colaborador.');
          console.error('Error al añadir rol:', err);
        }
      });
  }

  public removeRoleFromMember(member: GroupedMember, rol: MemberRoleItem): void {
    const company = this.activeCompany();
    if (!company?.cmp_uuid) return;

    if (member.roles.length <= 1) {
      this.confirmUnlink(member);
      return;
    }

    if (
      this.isCurrentSessionUser(member) &&
      (rol.rol_name.toUpperCase().includes('DUEÑO') || rol.rol_name.toUpperCase().includes('OWNER'))
    ) {
      this.errorMessage.set('No podés quitarte tu propio rol de Dueño/Administrador de la sesión activa.');
      setTimeout(() => this.errorMessage.set(null), 3500);
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    this._userRolesCompanyService
      .deleteUserRolCompany(company.cmp_uuid, member.usr_uuid, rol.rol_uuid)
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.successMessage.set(`Rol ${rol.rol_name} removido de ${member.usr_name}.`);
          this.loadTeam();
          setTimeout(() => this.successMessage.set(null), 3000);
        },
        error: (err) => {
          this.isSaving.set(false);
          this.errorMessage.set(err?.error?.message || 'Error al quitar el rol.');
          console.error('Error al quitar rol:', err);
        }
      });
  }

  public openAddModal(): void {
    this.addMode.set('new');
    this.newUsrName.set('');
    this.newUsrSurname.set('');
    this.newUsrNick.set('');
    this.newUsrEmail.set('');
    this.newUsrPassword.set('');
    this.existingUsrUuid.set('');
    const roles = this.availableRoles();
    if (roles.length > 0) {
      this.newRolUuid.set(roles[0].rol_uuid);
      this.existingRolUuid.set(roles[0].rol_uuid);
    }
    this.isAddModalOpen.set(true);
  }

  public closeAddModal(): void {
    this.isAddModalOpen.set(false);
  }

  public submitAddCollaborator(): void {
    const company = this.activeCompany();
    if (!company?.cmp_uuid) {
      this.errorMessage.set('No hay una compañía activa seleccionada.');
      return;
    }

    if (this.addMode() === 'new') {
      const name = this.newUsrName().trim();
      const surname = this.newUsrSurname().trim();
      const nick = this.newUsrNick().trim();
      const email = this.newUsrEmail().trim();
      const password = this.newUsrPassword().trim();
      const rol_uuid = this.newRolUuid();

      if (!name || !email || !password || !nick || !rol_uuid) {
        this.errorMessage.set('Por favor completa todos los campos obligatorios del nuevo usuario.');
        return;
      }

      this.isSaving.set(true);
      this.errorMessage.set(null);

      this._usersService
        .saveUser({
          usr_name: name,
          usr_surname: surname,
          usr_nick: nick,
          usr_email: email,
          usr_password: password
        })
        .subscribe({
          next: (userRes) => {
            const createdUser = userRes?.data;
            if (!createdUser?.usr_uuid) {
              this.isSaving.set(false);
              this.errorMessage.set('El usuario fue creado pero no se obtuvo su identificador para asignarlo.');
              return;
            }

            this._userRolesCompanyService
              .saveUserRolCompany({
                cmp_uuid: company.cmp_uuid,
                usr_uuid: createdUser.usr_uuid,
                rol_uuid
              })
              .subscribe({
                next: () => {
                  this.isSaving.set(false);
                  this.isAddModalOpen.set(false);
                  this.successMessage.set(`Colaborador ${name} incorporado exitosamente al equipo.`);
                  this.loadTeam();
                  this.loadUsers();
                  setTimeout(() => this.successMessage.set(null), 3500);
                },
                error: (linkErr) => {
                  this.isSaving.set(false);
                  this.errorMessage.set(linkErr?.error?.message || 'Usuario creado pero falló la vinculación con la empresa.');
                }
              });
          },
          error: (err) => {
            this.isSaving.set(false);
            this.errorMessage.set(err?.error?.message || err?.error?.error || 'Error al crear el nuevo usuario.');
          }
        });
    } else {
      const usr_uuid = this.existingUsrUuid();
      const rol_uuid = this.existingRolUuid();

      if (!usr_uuid || !rol_uuid) {
        this.errorMessage.set('Debes seleccionar un usuario y su correspondiente rol.');
        return;
      }

      this.isSaving.set(true);
      this.errorMessage.set(null);

      this._userRolesCompanyService
        .saveUserRolCompany({
          cmp_uuid: company.cmp_uuid,
          usr_uuid,
          rol_uuid
        })
        .subscribe({
          next: () => {
            this.isSaving.set(false);
            this.isAddModalOpen.set(false);
            this.successMessage.set('Usuario vinculado exitosamente al equipo.');
            this.loadTeam();
            setTimeout(() => this.successMessage.set(null), 3500);
          },
          error: (err) => {
            this.isSaving.set(false);
            this.errorMessage.set(err?.error?.message || 'Error al vincular el usuario a la empresa.');
          }
        });
    }
  }

  public confirmUnlink(member: GroupedMember): void {
    if (this.isCurrentSessionUser(member)) {
      this.errorMessage.set('No podés desvincular tu propio usuario de la empresa en esta sesión activa.');
      setTimeout(() => this.errorMessage.set(null), 4000);
      return;
    }
    this.memberToUnlink.set(member);
  }

  public cancelUnlink(): void {
    this.memberToUnlink.set(null);
  }

  public executeUnlink(): void {
    const member = this.memberToUnlink();
    const company = this.activeCompany();
    if (!member || !company?.cmp_uuid) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const deleteObservables = member.roles.map((r) =>
      this._userRolesCompanyService.deleteUserRolCompany(company.cmp_uuid, member.usr_uuid, r.rol_uuid)
    );

    forkJoin(deleteObservables).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.memberToUnlink.set(null);
        this.successMessage.set(`Colaborador ${member.usr_name} desvinculado exitosamente.`);
        this.loadTeam();
        setTimeout(() => this.successMessage.set(null), 3500);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.memberToUnlink.set(null);
        this.errorMessage.set(err?.error?.message || 'Error al desvincular el colaborador.');
        this.loadTeam();
      }
    });
  }

  public isCurrentSessionUser(member: GroupedMember): boolean {
    return this.currentUser()?.usr_uuid === member.usr_uuid;
  }

  public getInitials(name?: string, surname?: string, nick?: string): string {
    const first = (name || '').trim().charAt(0);
    const last = (surname || '').trim().charAt(0);
    const initials = `${first}${last}`.toUpperCase();
    return initials || (nick ? nick.charAt(0).toUpperCase() : 'U');
  }

  public getRoleBadgeClass(roleName?: string): string {
    const name = (roleName || '').toUpperCase();
    if (name.includes('DUEÑO') || name.includes('OWNER') || name.includes('ADMIN')) {
      return 'badge-role-owner';
    }
    if (name.includes('VENDEDOR') || name.includes('SELLER') || name.includes('VENTAS')) {
      return 'badge-role-seller';
    }
    if (name.includes('CHOFER') || name.includes('DRIVER') || name.includes('REPARTO') || name.includes('LOGISTICA')) {
      return 'badge-role-driver';
    }
    if (name.includes('OPERARIO') || name.includes('PRODUCCION')) {
      return 'badge-role-production';
    }
    return 'badge-role-default';
  }
}
