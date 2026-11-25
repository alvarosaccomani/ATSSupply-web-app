import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PermissionInterface,
  PermissionResultsInterface,
  PermissionSingleResultInterface
} from '@interfaces/permission';
import { SingleResult } from '@interfaces/common';

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  constructor(private readonly _http: HttpClient) {}

  /**
   * Obtiene la lista completa de permisos atómicos del sistema.
   */
  public getPermissions(
    filter?: string,
    page?: number,
    perPage?: number
  ): Observable<PermissionResultsInterface | SingleResult<PermissionInterface[]>> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    let url = `${environment.apiUrl}permissions`;

    if (filter) {
      url += `/${encodeURIComponent(filter)}`;
      if (page !== undefined) {
        url += `/${page}`;
        if (perPage !== undefined) {
          url += `/${perPage}`;
        }
      }
    } else if (page !== undefined && perPage !== undefined) {
      url += `?page=${page}&perPage=${perPage}`;
    }

    return this._http.get<PermissionResultsInterface | SingleResult<PermissionInterface[]>>(url, { headers });
  }

  /**
   * Obtiene el detalle de un permiso específico por su UUID.
   */
  public getPermissionById(per_uuid: string): Observable<PermissionSingleResultInterface> {
    const headers = new HttpHeaders().set('content-type', 'application/json');
    return this._http.get<PermissionSingleResultInterface>(
      `${environment.apiUrl}permission/${per_uuid}`,
      { headers }
    );
  }
}