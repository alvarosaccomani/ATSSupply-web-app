import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  UserRolCompanyInterface,
  UserRolCompanyResultsInterface,
  UserRolCompanySingleResultInterface
} from '@interfaces/user-rol-company';

@Injectable({
  providedIn: 'root'
})
export class UserRolesCompanyService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene todos los roles de usuario asignados a una compañía.
   */
  public getUserRolesCompany(cmp_uuid: string): Observable<UserRolCompanyResultsInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<UserRolCompanyResultsInterface>(
      `${environment.apiUrl}user-roles-company/${cmp_uuid}`,
      { headers }
    );
  }

  /**
   * Obtiene una asignación específica de rol por clave compuesta (cmp_uuid, usr_uuid, rol_uuid).
   */
  public getUserRolCompanyById(
    cmp_uuid: string,
    usr_uuid: string,
    rol_uuid: string
  ): Observable<UserRolCompanySingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<UserRolCompanySingleResultInterface>(
      `${environment.apiUrl}user-rol-company/${cmp_uuid}/${usr_uuid}/${rol_uuid}`,
      { headers }
    );
  }

  /**
   * Asocia un rol a un usuario en una compañía.
   */
  public saveUserRolCompany(
    userRolCompany: Partial<UserRolCompanyInterface>
  ): Observable<UserRolCompanySingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.post<UserRolCompanySingleResultInterface>(
      `${environment.apiUrl}user-rol-company`,
      userRolCompany,
      { headers }
    );
  }

  /**
   * Actualiza una asignación de rol de usuario en una compañía.
   */
  public updateUserRolCompany(
    cmp_uuid: string,
    usr_uuid: string,
    rol_uuid: string,
    userRolCompany: Partial<UserRolCompanyInterface>
  ): Observable<UserRolCompanySingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.put<UserRolCompanySingleResultInterface>(
      `${environment.apiUrl}user-rol-company/${cmp_uuid}/${usr_uuid}/${rol_uuid}`,
      userRolCompany,
      { headers }
    );
  }

  /**
   * Cambia el rol de un miembro en una compañía reasignando la clave compuesta.
   */
  public changeMemberRole(
    cmp_uuid: string,
    usr_uuid: string,
    old_rol_uuid: string,
    new_rol_uuid: string
  ): Observable<any> {
    if (old_rol_uuid === new_rol_uuid) {
      return of({ success: true, message: 'El rol no cambió.' });
    }
    return this.deleteUserRolCompany(cmp_uuid, usr_uuid, old_rol_uuid).pipe(
      switchMap(() => this.saveUserRolCompany({ cmp_uuid, usr_uuid, rol_uuid: new_rol_uuid }))
    );
  }

  /**
   * Elimina una asignación de rol de usuario en una compañía.
   */
  public deleteUserRolCompany(
    cmp_uuid: string,
    usr_uuid: string,
    rol_uuid: string
  ): Observable<any> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.delete<any>(
      `${environment.apiUrl}user-rol-company/${cmp_uuid}/${usr_uuid}/${rol_uuid}`,
      { headers }
    );
  }

  /**
   * Obtiene las compañías y roles asociados a un usuario.
   */
  public getUserRolesCompanyByUser(usr_uuid: string): Observable<UserRolCompanyResultsInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<UserRolCompanyResultsInterface>(
      `${environment.apiUrl}user-roles-company-by-user/${usr_uuid}`,
      { headers }
    );
  }

  /**
   * Obtiene los roles de un usuario en una compañía específica.
   */
  public getUserRolesCompanyByCompanyUser(
    cmp_uuid: string,
    usr_uuid: string
  ): Observable<UserRolCompanyResultsInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<UserRolCompanyResultsInterface>(
      `${environment.apiUrl}user-roles-company-by-company-user/${cmp_uuid}/${usr_uuid}`,
      { headers }
    );
  }
}
