import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@services/auth';
import { CompanyContextService } from '@services/company-context';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  private readonly _authService = inject(AuthService);
  private readonly _companyContext = inject(CompanyContextService);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);

  // Campos de formulario reactivos
  readonly username = signal<string>('');
  readonly password = signal<string>('');
  readonly showPassword = signal<boolean>(false);

  // Estado de petición
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  public togglePasswordVisibility(): void {
    this.showPassword.update((val) => !val);
  }

  public onSubmit(): void {
    const usr = this.username().trim();
    const pass = this.password().trim();

    if (!usr || !pass) {
      this.errorMessage.set('Por favor, ingresá tu usuario y contraseña.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._authService
      .login({
        usr_user: usr,
        usr_password: pass
      })
      .subscribe({
        next: () => {
          const usr_uuid = this._authService.currentUser()?.usr_uuid;
          const returnUrl = this._route.snapshot.queryParams['returnUrl'] || '/admin/user/dashboard';

          if (usr_uuid) {
            // Cargar empresas y roles del usuario autenticado
            this._companyContext.loadUserContext(usr_uuid).subscribe({
              next: () => {
                this.isLoading.set(false);
                this._router.navigateByUrl(returnUrl);
              },
              error: (err) => {
                console.warn('Error al cargar contexto de usuario post-login:', err);
                this.isLoading.set(false);
                this._router.navigateByUrl(returnUrl);
              }
            });
          } else {
            this.isLoading.set(false);
            this._router.navigateByUrl(returnUrl);
          }
        },
        error: (err) => {
          this.isLoading.set(false);
          const msg =
            err.error?.message ||
            err.error?.error ||
            'Error al iniciar sesión. Verificá tus credenciales o el estado de tu cuenta.';
          this.errorMessage.set(msg);
        }
      });
  }
}
