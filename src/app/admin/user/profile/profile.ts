import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@services/auth';
import { UsersService } from '@services/users';
import { CompanyContextService } from '@services/company-context';
import { UserRolesCompanyService } from '@services/user-roles-company';
import { UserRolCompanyInterface } from '@interfaces/user-rol-company';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class Profile implements OnInit {
  private readonly _authService = inject(AuthService);
  private readonly _usersService = inject(UsersService);
  private readonly _companyContext = inject(CompanyContextService);
  private readonly _userRolesCompanyService = inject(UserRolesCompanyService);

  // Sesión y Contexto
  readonly currentUser = this._authService.currentUser;
  readonly activeCompany = this._companyContext.activeCompany;
  readonly currentRoleLabel = this._companyContext.roleLabel;

  // Estados de carga y guardado
  readonly isLoading = signal<boolean>(false);
  readonly isSavingPersonal = signal<boolean>(false);
  readonly isSavingPassword = signal<boolean>(false);

  // Mensajes de feedback
  readonly personalSuccessMessage = signal<string | null>(null);
  readonly personalErrorMessage = signal<string | null>(null);
  readonly passwordSuccessMessage = signal<string | null>(null);
  readonly passwordErrorMessage = signal<string | null>(null);

  // Campos de Información Personal
  readonly name = signal<string>('');
  readonly surname = signal<string>('');
  readonly nick = signal<string>('');
  readonly email = signal<string>('');
  readonly bio = signal<string>('');

  // Campos de Cambio de Contraseña
  readonly newPassword = signal<string>('');
  readonly confirmPassword = signal<string>('');

  // Membresías en Empresas y Roles
  readonly userCompanyRoles = signal<UserRolCompanyInterface[]>([]);

  // Iniciales del usuario para avatar grande
  readonly userInitials = computed<string>(() => {
    const user = this.currentUser();
    if (!user) return 'AT';
    const first = (this.name() || user.usr_name || '').trim().charAt(0);
    const last = (this.surname() || user.usr_surname || '').trim().charAt(0);
    const initials = `${first}${last}`.toUpperCase();
    return initials || (this.nick() ? this.nick().charAt(0).toUpperCase() : 'U');
  });

  // Nombre de display completo
  readonly displayName = computed<string>(() => {
    const full = `${this.name()} ${this.surname()}`.trim();
    return full || this.nick() || this.email() || 'Usuario ATS';
  });

  ngOnInit(): void {
    this.initUserData();
    this.loadUserMemberships();
  }

  public initUserData(): void {
    const user = this.currentUser();
    if (user) {
      this.name.set(user.usr_name || '');
      this.surname.set(user.usr_surname || '');
      this.nick.set(user.usr_nick || '');
      this.email.set(user.usr_email || '');
      this.bio.set(user.usr_bio || '');
    }
  }

  public loadUserMemberships(): void {
    const user = this.currentUser();
    if (!user?.usr_uuid) return;

    this.isLoading.set(true);
    this._userRolesCompanyService.getUserRolesCompanyByUser(user.usr_uuid).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const data = (res as any)?.data || [];
        this.userCompanyRoles.set(data);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error al cargar membresías del usuario:', err);
      }
    });
  }

  public savePersonalInfo(): void {
    const user = this.currentUser();
    if (!user?.usr_uuid) return;

    const usr_name = this.name().trim();
    const usr_surname = this.surname().trim();
    const usr_nick = this.nick().trim();
    const usr_email = this.email().trim();
    const usr_bio = this.bio().trim();

    if (!usr_name || !usr_nick || !usr_email) {
      this.personalErrorMessage.set('Nombre, Usuario (Nick) y Correo son campos obligatorios.');
      return;
    }

    this.isSavingPersonal.set(true);
    this.personalErrorMessage.set(null);
    this.personalSuccessMessage.set(null);

    this._usersService
      .updateUser(user.usr_uuid, {
        usr_name,
        usr_surname,
        usr_nick,
        usr_email,
        usr_bio
      })
      .subscribe({
        next: () => {
          this.isSavingPersonal.set(false);
          this.personalSuccessMessage.set('Tus datos personales fueron actualizados correctamente.');
          // Actualizar sesión en AuthService
          this._authService.updateStoredUser({
            usr_name,
            usr_surname,
            usr_nick,
            usr_email,
            usr_bio
          });
          setTimeout(() => this.personalSuccessMessage.set(null), 3500);
        },
        error: (err) => {
          this.isSavingPersonal.set(false);
          this.personalErrorMessage.set(err?.error?.message || err?.error?.error || 'Error al actualizar datos.');
        }
      });
  }

  public savePassword(): void {
    const user = this.currentUser();
    if (!user?.usr_uuid) return;

    const newPass = this.newPassword().trim();
    const confPass = this.confirmPassword().trim();

    if (!newPass || !confPass) {
      this.passwordErrorMessage.set('Por favor completa ambos campos de contraseña.');
      return;
    }

    if (newPass.length < 6) {
      this.passwordErrorMessage.set('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPass !== confPass) {
      this.passwordErrorMessage.set('Las contraseñas no coinciden. Verifícalas e inténtalo nuevamente.');
      return;
    }

    this.isSavingPassword.set(true);
    this.passwordErrorMessage.set(null);
    this.passwordSuccessMessage.set(null);

    this._usersService
      .updateUser(user.usr_uuid, {
        usr_password: newPass
      })
      .subscribe({
        next: () => {
          this.isSavingPassword.set(false);
          this.newPassword.set('');
          this.confirmPassword.set('');
          this.passwordSuccessMessage.set('Contraseña actualizada con éxito.');
          setTimeout(() => this.passwordSuccessMessage.set(null), 3500);
        },
        error: (err) => {
          this.isSavingPassword.set(false);
          this.passwordErrorMessage.set(err?.error?.message || 'Error al actualizar la contraseña.');
        }
      });
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
