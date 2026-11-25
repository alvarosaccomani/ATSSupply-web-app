import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  RolPermissionInterface,
  RolPermissionResultsInterface,
  RolPermissionSingleResultInterface
} from '@interfaces/rol-permission';
import { SingleResult } from '@interfaces/common';

@Injectable({
  providedIn: 'root'
})
export class RolesPermissionsService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene todas las asignaciones globales de roles y permisos.
   */
  public getAllRolesPermissions(): Observable<SingleResult<RolPermissionInterface[]>> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<SingleResult<RolPermissionInterface[]>>(
      `${environment.apiUrl}roles-permissions`,
      { headers }
    );
  }

  /**
   * Obtiene la lista de permisos asignados a un rol específico.
   */
  public getPermissionsByRol(rol_uuid: string): Observable<SingleResult<RolPermissionInterface[]>> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<SingleResult<RolPermissionInterface[]>>(
      `${environment.apiUrl}roles-permissions/rol/${rol_uuid}`,
      { headers }
    );
  }

  /**
   * Obtiene los roles que poseen un permiso específico.
   */
  public getRolesByPermission(per_uuid: string): Observable<SingleResult<RolPermissionInterface[]>> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<SingleResult<RolPermissionInterface[]>>(
      `${environment.apiUrl}roles-permissions/permission/${per_uuid}`,
      { headers }
    );
  }

  /**
   * Asigna un permiso individual a un rol.
   */
  public assignPermissionToRol(
    rol_uuid: string,
    per_uuid: string
  ): Observable<RolPermissionSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.post<RolPermissionSingleResultInterface>(
      `${environment.apiUrl}rol-permission`,
      { rol_uuid, per_uuid },
      { headers }
    );
  }

  /**
   * Desvincula un permiso individual de un rol.
   */
  public removePermissionFromRol(
    rol_uuid: string,
    per_uuid: string
  ): Observable<RolPermissionSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.delete<RolPermissionSingleResultInterface>(
      `${environment.apiUrl}rol-permission/${rol_uuid}/${per_uuid}`,
      { headers }
    );
  }

  /**
   * Sincroniza en bloque la lista completa de permisos para un rol (operación atómica).
   */
  public syncPermissionsToRol(
    rol_uuid: string,
    per_uuids: string[]
  ): Observable<SingleResult<RolPermissionInterface[]>> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.put<SingleResult<RolPermissionInterface[]>>(
      `${environment.apiUrl}roles-permissions/sync/${rol_uuid}`,
      { per_uuids },
      { headers }
    );
  }
}