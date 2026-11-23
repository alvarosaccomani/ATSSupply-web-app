import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '@services/auth';

/**
 * Interceptor HTTP funcional que inyecta la cabecera Bearer token
 * y captura respuestas 401 para limpiar la sesión expirada.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.token();

  // No adjuntar token en llamadas de login
  const isLoginRequest = req.url.includes('/login');

  let authReq = req;
  if (token && !isLoginRequest) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isLoginRequest) {
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};
