import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { CompanyContextService } from '@services/company-context';

/**
 * Guard funcional que protege las rutas de Configuración Madre (application).
 * Permite el acceso únicamente a usuarios que posean el rol de SYSADMIN.
 * Redirige a /admin/user/dashboard si el usuario no cuenta con privilegios de Sysadmin.
 */
export const sysadminGuard: CanActivateFn = () => {
  const companyContext = inject(CompanyContextService);
  const router = inject(Router);

  if (companyContext.hasSysAdminRole()) {
    return true;
  }

  return router.createUrlTree(['/admin/user/dashboard']);
};
