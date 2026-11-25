import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthInterface,
  AuthSingleResultInterface,
  AuthUser,
  LoginCredentials
} from '@interfaces/auth';

const STORAGE_KEYS = {
  TOKEN: 'ats_token',
  USER: 'ats_user'
} as const;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly _http = inject(HttpClient);
  private readonly _router = inject(Router);

  // Estado reactivo de sesión
  readonly token = signal<string | null>(this._getStoredToken());
  readonly currentUser = signal<AuthUser | null>(this._getStoredUser());
  readonly isAuthenticated = computed<boolean>(() => !!this.token());

  /**
   * Autentica al usuario contra el backend y almacena la sesión.
   */
  public login(credentials: LoginCredentials): Observable<AuthSingleResultInterface> {
    const payload: LoginCredentials = {
      usr_user: credentials.usr_user,
      usr_password: credentials.usr_password,
      gettoken: true
    };

    const headers = new HttpHeaders().set('content-type', 'application/json');

    return this._http
      .post<AuthSingleResultInterface>(`${environment.apiUrl}login`, payload, { headers })
      .pipe(
        tap((response) => {
          if (response?.data?.token) {
            this.setSession(response.data.token);
          }
        })
      );
  }

  /**
   * Establece el token y decodifica la identidad del usuario.
   */
  public setSession(token: string): void {
    const user = this._decodeJwtPayload(token);
    this.token.set(token);
    this.currentUser.set(user);

    try {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      if (user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      }
    } catch (e) {
      console.warn('No se pudo acceder a LocalStorage para guardar sesión:', e);
    }
  }

  /**
   * Cierra la sesión activa y redirige al login.
   */
  public logout(): void {
    this.token.set(null);
    this.currentUser.set(null);

    try {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    } catch (e) {
      console.warn('No se pudo limpiar LocalStorage:', e);
    }

    this._router.navigate(['/auth/login']);
  }

  /**
   * Actualiza los datos del usuario en la sesión local.
   */
  public updateStoredUser(updatedUser: Partial<AuthUser>): void {
    const current = this.currentUser();
    if (!current) return;
    const merged = { ...current, ...updatedUser };
    this.currentUser.set(merged);
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(merged));
    } catch (e) {
      console.warn('No se pudo actualizar usuario en LocalStorage:', e);
    }
  }

  private _getStoredToken(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.TOKEN);
    } catch {
      return null;
    }
  }

  private _getStoredUser(): AuthUser | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER);
      if (stored) {
        return JSON.parse(stored) as AuthUser;
      }
      const token = this._getStoredToken();
      return token ? this._decodeJwtPayload(token) : null;
    } catch {
      return null;
    }
  }

  private _decodeJwtPayload(token: string): AuthUser | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const decoded = JSON.parse(jsonPayload);
      return {
        usr_uuid: decoded.sub || decoded.usr_uuid || '',
        usr_nick: decoded.usr_nick || '',
        usr_name: decoded.usr_name || '',
        usr_surname: decoded.usr_surname || '',
        usr_email: decoded.usr_email || '',
        usr_image: decoded.usr_image || null
      };
    } catch {
      return null;
    }
  }
}
